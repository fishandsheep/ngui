import type { ConfigIssue, NginxBlock, NginxDirective, NginxNode } from "./types";
import { isBlock } from "./parser";

const passDirectives = new Set(["proxy_pass", "fastcgi_pass", "grpc_pass", "uwsgi_pass", "scgi_pass", "memcached_pass"]);
const terminalRouteDirectives = new Set(["proxy_pass", "fastcgi_pass", "grpc_pass", "uwsgi_pass", "scgi_pass", "memcached_pass", "return", "try_files"]);

export function analyzeNginxConfig(ast: NginxBlock): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const upstreamDefinitions = new Map<string, NginxBlock[]>();

  walk(ast, (node, parents) => {
    if (!isBlock(node)) return;

    if (node.name === "upstream") {
      const name = node.args[0] || node.id;
      const existing = upstreamDefinitions.get(name) || [];
      existing.push(node);
      upstreamDefinitions.set(name, existing);

      if (directives(node, "server").length === 0) {
        issues.push(createIssue("warning", "upstream", "upstream.empty", node, { name }, "upstream.addServer"));
      }
    }

    if (node.name === "server") {
      const context = nearestContext(parents);
      const listens = directives(node, "listen");
      if (listens.length === 0) {
        issues.push(createIssue("warning", "server", "server.missingListen", node, {}, "server.addListen"));
      }

      if (context === "http" && directives(node, "server_name").length === 0) {
        issues.push(createIssue("info", "server", "server.missingServerName", node, {}, "server.addServerName"));
      }

      const seenListens = new Set<string>();
      listens.forEach((listen) => {
        const signature = listen.args.join(" ").trim();
        if (!signature) return;
        if (seenListens.has(signature)) {
          issues.push(createIssue("warning", "server", "server.duplicateListen", listen, { value: signature }, "server.deduplicateListen"));
          return;
        }
        seenListens.add(signature);
      });
    }

    if ((node.name === "server" || node.name === "location") && node.children.some((child) => isBlock(child) && child.name === "if")) {
      issues.push(createIssue("info", node.name, `${node.name}.containsIf`, node, {}, `${node.name}.reviewIf`));
    }

    if (node.name === "location") {
      const hasTerminalDirective = node.children.some((child) => !isBlock(child) && terminalRouteDirectives.has(child.name));
      if (!hasTerminalDirective) {
        issues.push(createIssue("info", "location", "location.missingTerminalRoute", node, { path: node.args.join(" ") || "/" }, "location.addTerminalRoute"));
      }
    }

  });

  walk(ast, (node) => {
    if (!isBlock(node)) return;
    node.children
      .filter((child): child is NginxDirective => !isBlock(child) && passDirectives.has(child.name))
      .forEach((directive) => {
        const target = directive.args[0];
        if (!target || hasVariable(target) || isDirectTarget(target)) return;
        const upstreamName = normalizeUpstreamName(target);
        if (!upstreamName) return;
        if (!upstreamDefinitions.has(upstreamName)) {
          issues.push(createIssue("warning", "upstream", "pass.undefinedUpstream", directive, { name: upstreamName, directive: directive.name }, "pass.defineUpstream"));
        }
      });
  });

  upstreamDefinitions.forEach((blocks, name) => {
    if (blocks.length < 2) return;
    blocks.slice(1).forEach((block) => {
      issues.push(createIssue("warning", "upstream", "upstream.duplicateName", block, { name }, "upstream.renameOrMerge"));
    });
  });

  return issues;
}

function createIssue(
  severity: ConfigIssue["severity"],
  category: string,
  messageKey: string,
  sourceNode: NginxDirective | NginxBlock,
  params: Record<string, string | number> = {},
  suggestionKey?: string
): ConfigIssue {
  return {
    id: `${messageKey}:${sourceNode.id}`,
    severity,
    category,
    messageKey,
    params,
    loc: sourceNode.loc,
    suggestionKey,
    source: "check"
  };
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

function hasVariable(target: string) {
  return /\$[a-zA-Z0-9_]+/.test(target);
}

function isDirectTarget(target: string) {
  if (target.startsWith("unix:")) return true;
  const stripped = target.replace(/^(https?|grpc|uwsgi|scgi|fastcgi|memcached):\/\//, "");
  const host = stripped.split(/[/:?]/)[0];
  if (!host) return true;
  if (host === "localhost") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (/^\[[0-9a-fA-F:]+\]$/.test(host)) return true;
  return host.includes(".");
}

function normalizeUpstreamName(target: string) {
  const stripped = target.replace(/^(https?|grpc|uwsgi|scgi|fastcgi|memcached):\/\//, "");
  if (stripped.startsWith("unix:")) return undefined;
  return stripped.split(/[/:?]/)[0];
}
