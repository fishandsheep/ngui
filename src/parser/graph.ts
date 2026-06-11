import { analyzeNginxConfig } from "./analyzer";
import { isBlock, parseNginxConfig } from "./parser";
import type { ConfigIssue, NginxBlock, NginxDirective, NginxNode, ParseError, TopologyEdge, TopologyGraph, TopologyNode } from "./types";

const passDirectives = new Set(["proxy_pass", "fastcgi_pass", "grpc_pass", "uwsgi_pass", "scgi_pass", "memcached_pass"]);

export function buildTopology(input: string): TopologyGraph {
  const parsed = parseNginxConfig(input);
  return buildTopologyFromAst(parsed.ast, parsed.errors);
}

export function buildTopologyFromAst(ast: NginxBlock, errors: ParseError[] = []): TopologyGraph {
  const nodes = new Map<string, TopologyNode>();
  const edges = new Map<string, TopologyEdge>();
  const issues = [...errors.map(parseErrorToIssue), ...analyzeNginxConfig(ast)];
  const upstreams = collectUpstreams(ast, nodes, edges);
  const maps = collectMaps(ast, nodes);

  walk(ast, (node, parents) => {
    if (!isBlock(node) || node.name !== "server") return;
    const context = nearestContext(parents);
    const serverId = addServer(node, context, nodes);
    const listens = directives(node, "listen");

    if (listens.length === 0) {
      const entryId = upsert(nodes, {
        id: `${context}-entry-default-${node.id}`,
        type: "entry",
        label: context === "stream" ? "stream listen" : "default listen",
        subtitle: context,
        source: node.loc,
        raw: node.raw,
        details: ["No explicit listen directive found."]
      });
      addEdge(edges, entryId, serverId, "flow", "serves");
    } else {
      listens.forEach((listen) => {
        const label = `${context} ${listen.args.join(" ")}`;
        const entryId = upsert(nodes, {
          id: `${context}-entry-${hash(label)}-${listen.id}`,
          type: "entry",
          label,
          subtitle: listen.args.join(" "),
          source: listen.loc,
          raw: listen.raw,
          details: [`Entry point declared by ${listen.raw}`]
        });
        addEdge(edges, entryId, serverId, "flow", "serves");
      });
    }

    if (context === "stream") {
      connectPasses(node, serverId, upstreams, maps, nodes, edges);
      return;
    }

    const locationBlocks = node.children.filter((child) => isBlock(child) && child.name === "location") as NginxBlock[];
    const inlineRoutes = node.children.filter((child) => !isBlock(child) && routeDirective(child));
    inlineRoutes.forEach((route) => connectRoute(route, serverId, upstreams, maps, nodes, edges));
    locationBlocks.forEach((location) => {
      const routeId = upsert(nodes, {
        id: `route-${location.id}`,
        type: "route",
        label: `location ${location.args.join(" ") || "/"}`,
        subtitle: summarizeDirectives(location.children),
        source: location.loc,
        raw: location.raw,
        details: collectDetails(location)
      });
      addEdge(edges, serverId, routeId, "flow", "matches");
      connectPasses(location, routeId, upstreams, maps, nodes, edges);
      location.children.filter((child) => !isBlock(child) && routeDirective(child)).forEach((route) => {
        connectRoute(route, routeId, upstreams, maps, nodes, edges);
      });
    });
  });

  return { nodes: [...nodes.values()], edges: [...edges.values()], issues };
}

function collectUpstreams(ast: NginxBlock, nodes: Map<string, TopologyNode>, edges: Map<string, TopologyEdge>) {
  const upstreams = new Map<string, string>();
  walk(ast, (node) => {
    if (!isBlock(node) || node.name !== "upstream") return;
    const name = node.args[0] || node.id;
    const upstreamId = upsert(nodes, {
      id: `upstream-${hash(name)}-${node.id}`,
      type: "upstream",
      label: name,
      subtitle: "upstream group",
      source: node.loc,
      raw: node.raw,
      details: collectDetails(node)
    });
    upstreams.set(name, upstreamId);
    directives(node, "server").forEach((backend) => {
      const label = backend.args.join(" ");
      const targetId = upsert(nodes, targetNode(`backend-${hash(`${name}-${label}`)}-${backend.id}`, label, backend));
      addEdge(edges, upstreamId, targetId, "flow", "balances");
    });
  });
  return upstreams;
}

function collectMaps(ast: NginxBlock, nodes: Map<string, TopologyNode>) {
  const maps = new Map<string, string>();
  walk(ast, (node) => {
    if (!isBlock(node) || node.name !== "map") return;
    const source = node.args[0] || "input";
    const target = node.args[1] || `$map_${node.id}`;
    const id = upsert(nodes, {
      id: `variable-${hash(target)}-${node.id}`,
      type: "variable",
      label: target,
      subtitle: `map from ${source}`,
      source: node.loc,
      raw: node.raw,
      details: collectDetails(node),
      confidence: "medium"
    });
    maps.set(target, id);
  });
  return maps;
}

function addServer(block: NginxBlock, context: string, nodes: Map<string, TopologyNode>) {
  const names = directives(block, "server_name").flatMap((directive) => directive.args);
  const label = names.length ? names.join(" ") : context === "stream" ? `stream server ${block.id}` : "default server";
  return upsert(nodes, {
    id: `${context}-server-${block.id}`,
    type: "server",
    label,
    subtitle: context,
    source: block.loc,
    raw: block.raw,
    details: collectDetails(block)
  });
}

function connectPasses(
  block: NginxBlock,
  sourceId: string,
  upstreams: Map<string, string>,
  maps: Map<string, string>,
  nodes: Map<string, TopologyNode>,
  edges: Map<string, TopologyEdge>
) {
  block.children.filter((child) => !isBlock(child) && passDirectives.has(child.name)).forEach((pass) => {
    const target = pass.args[0] || "unknown";
    const variable = target.match(/\$[a-zA-Z0-9_]+/)?.[0];
    if (variable) {
      const variableId = maps.get(variable) || upsert(nodes, {
        id: `variable-dynamic-${hash(variable)}-${pass.id}`,
        type: "variable",
        label: variable,
        subtitle: "dynamic target",
        source: pass.loc,
        raw: pass.raw,
        details: [`Dynamic expression: ${target}`],
        confidence: "low"
      });
      addEdge(edges, sourceId, variableId, "dynamic", pass.name, pass.raw);
      const targetId = upsert(nodes, targetNode(`target-dynamic-${hash(target)}-${pass.id}`, target, pass, "low"));
      addEdge(edges, variableId, targetId, "dynamic", "resolves");
      return;
    }

    const upstreamName = normalizeUpstreamName(target);
    const upstreamId = upstreamName ? upstreams.get(upstreamName) : undefined;
    if (upstreamId) {
      addEdge(edges, sourceId, upstreamId, "flow", pass.name, pass.raw);
      return;
    }

    const targetId = upsert(nodes, targetNode(`target-${hash(target)}-${pass.id}`, target, pass));
    addEdge(edges, sourceId, targetId, "flow", pass.name, pass.raw);
  });
}

function connectRoute(
  directive: NginxDirective,
  sourceId: string,
  upstreams: Map<string, string>,
  maps: Map<string, string>,
  nodes: Map<string, TopologyNode>,
  edges: Map<string, TopologyEdge>
) {
  const routeId = upsert(nodes, {
    id: `route-${directive.id}`,
    type: "route",
    label: directive.name,
    subtitle: directive.args.join(" "),
    source: directive.loc,
    raw: directive.raw,
    details: [directive.raw]
  });
  addEdge(edges, sourceId, routeId, directive.name === "rewrite" ? "rewrite" : "flow", directive.name, directive.raw);
  connectPasses({ ...directive, children: [] }, routeId, upstreams, maps, nodes, edges);
}

function targetNode(id: string, label: string, directive: NginxDirective, confidence: "high" | "medium" | "low" = "high"): TopologyNode {
  return {
    id,
    type: "target",
    label,
    subtitle: directive.name,
    source: directive.loc,
    raw: directive.raw,
    details: [`Target declared by ${directive.raw}`],
    confidence
  };
}

function routeDirective(node: NginxNode) {
  return !isBlock(node) && ["rewrite", "return", "try_files"].includes(node.name);
}

function directives(block: NginxBlock, name: string) {
  return block.children.filter((child) => !isBlock(child) && child.name === name) as NginxDirective[];
}

function nearestContext(parents: NginxBlock[]) {
  return parents.some((parent) => parent.name === "stream") ? "stream" : "http";
}

function walk(block: NginxBlock, visit: (node: NginxNode, parents: NginxBlock[]) => void, parents: NginxBlock[] = []) {
  block.children.forEach((child) => {
    visit(child, [...parents, block]);
    if (isBlock(child)) walk(child, visit, [...parents, block]);
  });
}

function addEdge(
  edges: Map<string, TopologyEdge>,
  source: string,
  target: string,
  type: TopologyEdge["type"],
  label?: string,
  sourceRaw?: string
) {
  const id = `${source}->${target}-${label || type}`;
  edges.set(id, { id, source, target, type, label, sourceRaw });
}

function upsert(nodes: Map<string, TopologyNode>, node: TopologyNode) {
  nodes.set(node.id, node);
  return node.id;
}

function normalizeUpstreamName(target: string) {
  const stripped = target.replace(/^(https?|grpc|uwsgi|scgi|fastcgi|memcached):\/\//, "");
  if (stripped.startsWith("unix:")) return undefined;
  return stripped.split(/[/:]/)[0];
}

function collectDetails(block: NginxBlock) {
  return block.children.slice(0, 12).map((child) => child.raw);
}

function directiveSummary(children: NginxNode[]) {
  const names = children.map((child) => child.name).slice(0, 4);
  return names.join(", ");
}

function summarizeDirectives(children: NginxNode[]) {
  const summary = directiveSummary(children);
  return summary || "route";
}

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(31, h) + value.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}

function parseErrorToIssue(error: ParseError, index: number): ConfigIssue {
  return {
    id: `parse:${index}:${error.loc.line}:${error.loc.column}`,
    severity: "error",
    category: "parse",
    messageKey: "parse.raw",
    params: { message: error.message },
    loc: error.loc,
    source: "parse"
  };
}
