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
    expect(graph.errors.some((error) => error.message.includes("Unclosed block"))).toBe(true);
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
});
