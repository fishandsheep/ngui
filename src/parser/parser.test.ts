import { describe, expect, it } from "vitest";
import { buildTopology, parseNginxConfig } from "./index";

const sample = `
# configuration file /etc/nginx/nginx.conf:
http {
  map $host $backend {
    default app_pool;
    api.example.com api_pool;
  }

  upstream app_pool {
    server 10.0.0.1:8080;
    server 10.0.0.2:8080 weight=2;
  }

  upstream api_pool {
    server unix:/run/api.sock;
  }

  server {
    listen 80;
    listen 443 ssl;
    server_name example.com api.example.com;

    location / {
      proxy_pass http://app_pool;
    }

    location /api {
      rewrite ^/api/(.*)$ /$1 break;
      proxy_pass http://$backend;
    }

    location /grpc {
      grpc_pass grpc://api_pool;
    }

    return 301 https://$host$request_uri;
  }
}

stream {
  upstream tcp_pool {
    server 127.0.0.1:9000;
  }

  server {
    listen 9001;
    proxy_pass tcp_pool;
  }
}
`;

describe("nginx parser", () => {
  it("builds an AST with source file markers and nested blocks", () => {
    const result = parseNginxConfig(sample);
    expect(result.errors).toEqual([]);
    expect(result.ast.children[0].name).toBe("http");
    expect(result.ast.children[0].loc.file).toBe("/etc/nginx/nginx.conf");
  });

  it("reports incomplete blocks without dropping partial topology", () => {
    const graph = buildTopology("http { server { listen 80; location / { proxy_pass http://app; }");
    expect(graph.issues.some((issue) => issue.source === "parse" && String(issue.params?.message).includes("Unclosed block"))).toBe(true);
    expect(graph.nodes.some((node) => node.type === "entry")).toBe(true);
  });
});

describe("topology model", () => {
  it("creates entries, routes, upstreams, targets, stream servers, and variable nodes", () => {
    const graph = buildTopology(sample);
    expect(graph.nodes.some((node) => node.type === "entry" && node.label.includes("443"))).toBe(true);
    expect(graph.nodes.some((node) => node.type === "server" && node.label.includes("example.com"))).toBe(true);
    expect(graph.nodes.some((node) => node.type === "route" && node.label.includes("/api"))).toBe(true);
    expect(graph.nodes.some((node) => node.type === "upstream" && node.label === "app_pool")).toBe(true);
    expect(graph.nodes.some((node) => node.type === "target" && node.label.includes("10.0.0.1"))).toBe(true);
    expect(graph.nodes.some((node) => node.type === "variable" && node.label === "$backend")).toBe(true);
    expect(graph.edges.some((edge) => edge.type === "dynamic")).toBe(true);
  });

  it("emits a warning when a server block has no listen directive", () => {
    const graph = buildTopology("http { server { server_name example.com; } }");
    expect(graph.issues.some((issue) => issue.messageKey === "server.missingListen" && issue.severity === "warning")).toBe(true);
  });

  it("emits a warning for an empty upstream", () => {
    const graph = buildTopology("http { upstream app {} }");
    expect(graph.issues.some((issue) => issue.messageKey === "upstream.empty" && issue.severity === "warning")).toBe(true);
  });

  it("emits a warning for undefined upstream references", () => {
    const graph = buildTopology("http { server { listen 80; location / { proxy_pass http://missing_pool; } } }");
    expect(graph.issues.some((issue) => issue.messageKey === "pass.undefinedUpstream" && issue.severity === "warning")).toBe(true);
  });

  it("emits a warning for duplicate upstream names", () => {
    const graph = buildTopology("http { upstream app { server 127.0.0.1:8080; } upstream app { server 127.0.0.1:8081; } }");
    expect(graph.issues.some((issue) => issue.messageKey === "upstream.duplicateName" && issue.severity === "warning")).toBe(true);
  });

  it("emits an info issue when using if inside a location", () => {
    const graph = buildTopology("http { server { listen 80; location / { if ($request_method = POST) { return 405; } } } }");
    expect(graph.issues.some((issue) => issue.messageKey === "location.containsIf" && issue.severity === "info")).toBe(true);
  });

  it("includes both parse issues and check issues in the same graph", () => {
    const graph = buildTopology("http { server { location / { proxy_pass http://missing_pool; }");
    expect(graph.issues.some((issue) => issue.source === "parse")).toBe(true);
    expect(graph.issues.some((issue) => issue.source === "check" && issue.messageKey === "server.missingListen")).toBe(true);
    expect(graph.issues.some((issue) => issue.source === "check" && issue.messageKey === "pass.undefinedUpstream")).toBe(true);
  });
});
