import { isBlock } from "./parser";
import type {
  LocationMatchInfo,
  NginxBlock,
  NginxDirective,
  NginxNode,
  RequestSimulationInput,
  RequestSimulationResult,
  RoutingListen,
  RoutingLocation,
  RoutingModel,
  RoutingServer,
  TopologyEdge
} from "./types";

export function buildRoutingModel(ast: NginxBlock): RoutingModel {
  const servers: RoutingServer[] = [];

  walk(ast, (node, parents) => {
    if (!isBlock(node) || node.name !== "server") return;
    const context = nearestContext(parents);
    const serverNodeId = `${context}-server-${node.id}`;
    servers.push({
      id: node.id,
      nodeId: serverNodeId,
      context,
      names: directives(node, "server_name").flatMap((directive) => directive.args),
      listens: directives(node, "listen").map((listen) => parseListen(listen, context)),
      locations: node.children
        .filter((child): child is NginxBlock => isBlock(child) && child.name === "location")
        .map((location, order) => ({
          id: location.id,
          nodeId: `route-${location.id}`,
          serverNodeId,
          order,
          source: location.loc,
          raw: location.raw,
          ...classifyLocation(location)
        }))
    });
  });

  return { servers };
}

export function classifyLocation(location: NginxBlock): LocationMatchInfo {
  const [first = "/", second = ""] = location.args;
  if (first === "=") {
    return { kind: "exact", pattern: second || "/", priority: 500 };
  }
  if (first === "^~") {
    return { kind: "prefix-priority", pattern: second || "/", priority: 400 };
  }
  if (first === "~") {
    return { kind: "regex-case-sensitive", pattern: second || "", priority: 300 };
  }
  if (first === "~*") {
    return { kind: "regex-case-insensitive", pattern: second || "", priority: 300 };
  }
  return { kind: "prefix", pattern: first || "/", priority: 100 };
}

export function matchLocation(locations: RoutingLocation[], path: string): RoutingLocation | undefined {
  const normalizedPath = normalizePath(path);
  const exact = locations.find((location) => location.kind === "exact" && location.pattern === normalizedPath);
  if (exact) return exact;

  const priorityPrefix = longestPrefix(locations.filter((location) => location.kind === "prefix-priority"), normalizedPath);
  if (priorityPrefix) return priorityPrefix;

  const normalPrefix = longestPrefix(locations.filter((location) => location.kind === "prefix"), normalizedPath);
  const regex = locations
    .filter((location) => location.kind === "regex-case-sensitive" || location.kind === "regex-case-insensitive")
    .sort((left, right) => left.order - right.order)
    .find((location) => regexMatches(location, normalizedPath));

  return regex || normalPrefix;
}

export function simulateRequest(
  routing: RoutingModel | undefined,
  edges: TopologyEdge[],
  input: RequestSimulationInput
): RequestSimulationResult {
  if (!routing) {
    return emptyResult("no-server", "Routing model unavailable.", "low");
  }

  const httpServers = routing.servers.filter((server) => server.context === "http");
  if (!input.port) {
    return emptyResult("no-server", "Enter a port to simulate the request route.", "low");
  }

  const server = selectServer(httpServers, input);
  if (!server) {
    return emptyResult("no-server", `No HTTP server matched ${input.host}:${input.port}.`, "low");
  }

  const nodeIds = new Set<string>([server.nodeId]);
  const listen = server.listens.find((item) => (item.port || defaultPort(input.scheme)) === input.port);
  if (listen?.nodeId) nodeIds.add(listen.nodeId);

  const location = matchLocation(server.locations, input.path);
  if (!location) {
    const nodeList = [...nodeIds];
    return {
      status: "no-location",
      confidence: server.names.length ? "medium" : "low",
      nodeIds: nodeList,
      edgeIds: collectPathEdges(edges, nodeList),
      summary: `Matched server ${formatServer(server)}, but no location matched ${normalizePath(input.path)}.`,
      reasons: [
        `Listen matched port ${input.port}.`,
        server.names.length ? `Server name matched ${input.host}.` : "Server has no explicit server_name.",
        "No matching location block found."
      ],
      serverId: server.nodeId
    };
  }

  nodeIds.add(location.nodeId);
  collectReachable(edges, location.nodeId, nodeIds, 4);
  const nodeList = [...nodeIds];
  const confidence = nodeList.some((id) => id.includes("dynamic") || id.startsWith("variable-")) ? "low" : (server.names.length ? "high" : "medium");

  return {
    status: "matched",
    confidence,
    nodeIds: nodeList,
    edgeIds: collectPathEdges(edges, nodeList),
    summary: `${input.host}${normalizePath(input.path)} matched ${formatLocation(location)} in ${formatServer(server)}.`,
    reasons: [
      `Listen matched port ${input.port}.`,
      server.names.length ? `Server name matched ${input.host}.` : "Fallback/default server matched.",
      `Location matched by ${location.kind}: ${location.pattern}.`,
      confidence === "low" ? "Dynamic variable target lowers confidence." : "Static route target resolved."
    ],
    serverId: server.nodeId,
    locationId: location.nodeId
  };
}

export function parseListen(directive: NginxDirective, context: "http" | "stream"): RoutingListen {
  const value = directive.args.join(" ").trim();
  return {
    value,
    port: extractPort(directive.args, context),
    ssl: directive.args.includes("ssl"),
    nodeId: `${context}-entry-${hash(`${context} ${value}`)}-${directive.id}`
  };
}

export function normalizePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function selectServer(servers: RoutingServer[], input: RequestSimulationInput) {
  if (!input.port) return undefined;
  const portMatches = servers.filter((server) => server.listens.length === 0 || server.listens.some((listen) => (listen.port || defaultPort(input.scheme)) === input.port));
  const candidates = portMatches;
  if (candidates.length === 0) return undefined;
  const exact = candidates.find((server) => server.names.some((name) => name === input.host));
  if (exact) return exact;
  const wildcard = candidates.find((server) => server.names.some((name) => wildcardMatches(name, input.host)));
  return wildcard || candidates[0];
}

function wildcardMatches(pattern: string, host: string) {
  if (pattern === "_" || pattern === "*") return true;
  if (pattern.startsWith("*.")) return host.endsWith(pattern.slice(1));
  if (pattern.endsWith(".*")) return host.startsWith(pattern.slice(0, -1));
  return false;
}

function longestPrefix(locations: RoutingLocation[], path: string) {
  return locations
    .filter((location) => path.startsWith(location.pattern))
    .sort((left, right) => right.pattern.length - left.pattern.length || left.order - right.order)[0];
}

function regexMatches(location: RoutingLocation, path: string) {
  try {
    const flags = location.kind === "regex-case-insensitive" ? "i" : "";
    return new RegExp(location.pattern, flags).test(path);
  } catch {
    return false;
  }
}

function collectReachable(edges: TopologyEdge[], sourceId: string, nodeIds: Set<string>, maxDepth: number) {
  const queue = [{ id: sourceId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) continue;
    edges.filter((edge) => edge.source === current.id).forEach((edge) => {
      if (!nodeIds.has(edge.target)) {
        nodeIds.add(edge.target);
        queue.push({ id: edge.target, depth: current.depth + 1 });
      }
    });
  }
}

function collectPathEdges(edges: TopologyEdge[], nodeIds: string[]) {
  const nodeSet = new Set(nodeIds);
  return edges.filter((edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target)).map((edge) => edge.id);
}

function formatServer(server: RoutingServer) {
  return server.names.join(" ") || server.nodeId;
}

function formatLocation(location: RoutingLocation) {
  return `location ${location.pattern}`;
}

function emptyResult(status: "no-server" | "no-location", summary: string, confidence: "high" | "medium" | "low"): RequestSimulationResult {
  return { status, confidence, nodeIds: [], edgeIds: [], summary, reasons: [summary] };
}

function extractPort(args: string[], context: "http" | "stream") {
  for (const arg of args) {
    const bracketMatch = arg.match(/^\[[^\]]+\]:(\d+)$/);
    if (bracketMatch) return Number(bracketMatch[1]);
    const portMatch = arg.match(/(?::|^)(\d+)$/);
    if (portMatch) return Number(portMatch[1]);
  }
  return context === "http" ? undefined : undefined;
}

function defaultPort(scheme: "http" | "https") {
  return scheme === "https" ? 443 : 80;
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

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(31, h) + value.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}
