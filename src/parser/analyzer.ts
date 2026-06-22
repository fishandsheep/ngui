import type { ConfigIssue, NginxBlock, NginxDirective, NginxNode } from "./types";
import { isBlock } from "./parser";
import { classifyLocation } from "./routing";

const passDirectives = new Set(["proxy_pass", "fastcgi_pass", "grpc_pass", "uwsgi_pass", "scgi_pass", "memcached_pass"]);
const terminalRouteDirectives = new Set(["proxy_pass", "fastcgi_pass", "grpc_pass", "uwsgi_pass", "scgi_pass", "memcached_pass", "return", "try_files"]);

export function analyzeNginxConfig(ast: NginxBlock): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const upstreamDefinitions = new Map<string, NginxBlock[]>();
  const serverNameDefinitions = new Map<string, Array<{ directive: NginxDirective; name: string }>>();

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

      const seenBackends = new Set<string>();
      directives(node, "server").forEach((backend) => {
        const signature = backend.args[0] || backend.args.join(" ");
        if (!signature) return;
        if (seenBackends.has(signature)) {
          issues.push(createIssue("warning", "upstream", "upstream.duplicateBackend", backend, { name, target: signature }, "upstream.deduplicateBackend"));
          return;
        }
        seenBackends.add(signature);
      });
    }

    if (node.name === "server") {
      const context = nearestContext(parents);
      const listens = directives(node, "listen");
      const serverNames = directives(node, "server_name");
      if (listens.length === 0) {
        issues.push(createIssue("warning", "server", "server.missingListen", node, {}, "server.addListen"));
      }

      if (context === "http" && serverNames.length === 0) {
        issues.push(createIssue("info", "server", "server.missingServerName", node, {}, "server.addServerName"));
      }

      serverNames.forEach((directive) => {
        directive.args.forEach((name) => {
          const key = `${context}:${listenPorts(listens).join(",") || "default"}:${name}`;
          const existing = serverNameDefinitions.get(key) || [];
          existing.push({ directive, name });
          serverNameDefinitions.set(key, existing);
        });
      });

      const seenListens = new Set<string>();
      listens.forEach((listen) => {
        const signature = listen.args.join(" ").trim();
        if (!signature) return;
        if (seenListens.has(signature)) {
          issues.push(createIssue("warning", "server", "server.duplicateListen", listen, { value: signature }, "server.deduplicateListen"));
          return;
        }
        seenListens.add(signature);

        if (context === "http" && listenPort(listen) === 443 && !listen.args.includes("ssl")) {
          issues.push(createIssue("warning", "server", "server.listen443WithoutSsl", listen, { value: signature }, "server.addSslFlag"));
        }
      });

      const hasSslListen = listens.some((listen) => listen.args.includes("ssl"));
      if (context === "http" && hasSslListen && directives(node, "ssl_certificate").length === 0) {
        issues.push(createIssue("warning", "server", "server.sslMissingCertificate", node, {}, "server.addSslCertificate"));
      }
    }

    if ((node.name === "server" || node.name === "location") && node.children.some((child) => isBlock(child) && child.name === "if")) {
      issues.push(createIssue("info", node.name, `${node.name}.containsIf`, node, {}, `${node.name}.reviewIf`));
    }

    if (node.name === "location") {
      const match = classifyLocation(node);
      const hasTerminalDirective = node.children.some((child) => !isBlock(child) && terminalRouteDirectives.has(child.name));
      if (!hasTerminalDirective) {
        issues.push(createIssue("info", "location", "location.missingTerminalRoute", node, { path: node.args.join(" ") || "/" }, "location.addTerminalRoute"));
      }

      node.children
        .filter((child): child is NginxDirective => !isBlock(child) && child.name === "proxy_pass")
        .forEach((directive) => {
          const target = directive.args[0] || "";
          if (match.kind === "prefix" && hasProxyPassUri(target)) {
            issues.push(createIssue("info", "location", "location.proxyPassUriWithPrefix", directive, { path: match.pattern, target }, "location.reviewProxyPassUri"));
          }
        });
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

  serverNameDefinitions.forEach((definitions) => {
    if (definitions.length < 2) return;
    definitions.slice(1).forEach(({ directive, name }) => {
      issues.push(createIssue("warning", "server", "server.duplicateServerName", directive, { name }, "server.deduplicateServerName"));
    });
  });

  walk(ast, (node) => {
    if (!isBlock(node) || node.name !== "server") return;
    const seenLocations = new Set<string>();
    node.children
      .filter((child): child is NginxBlock => isBlock(child) && child.name === "location")
      .forEach((location) => {
        const match = classifyLocation(location);
        const signature = `${match.kind}:${match.pattern}`;
        if (seenLocations.has(signature)) {
          issues.push(createIssue("warning", "location", "location.duplicate", location, { path: location.args.join(" ") || "/" }, "location.mergeDuplicate"));
          return;
        }
        seenLocations.add(signature);
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

function listenPorts(listens: NginxDirective[]) {
  const ports = listens.map(listenPort).filter((port): port is number => Boolean(port));
  return ports.length ? ports : [80];
}

function listenPort(listen: NginxDirective) {
  for (const arg of listen.args) {
    const bracketMatch = arg.match(/^\[[^\]]+\]:(\d+)$/);
    if (bracketMatch) return Number(bracketMatch[1]);
    const portMatch = arg.match(/(?::|^)(\d+)$/);
    if (portMatch) return Number(portMatch[1]);
  }
  return undefined;
}

function hasProxyPassUri(target: string) {
  const stripped = target.replace(/^(https?|grpc|uwsgi|scgi|fastcgi|memcached):\/\//, "");
  const slashIndex = stripped.indexOf("/");
  return slashIndex >= 0 && slashIndex < stripped.length - 1;
}
