import { describe, expect, it } from "vitest";
import { buildTopology, simulateRequest } from "./index";

describe("request routing simulation", () => {
  it("matches exact locations before prefix locations", () => {
    const graph = buildTopology(`
      http {
        upstream app { server 127.0.0.1:8080; }
        server {
          listen 80;
          server_name example.com;
          location /api { proxy_pass http://app; }
          location = /api/health { return 200; }
        }
      }
    `);

    const result = simulateRequest(graph.routing, graph.edges, {
      host: "example.com",
      path: "/api/health",
      scheme: "http",
      port: 80
    });

    expect(result.status).toBe("matched");
    expect(result.summary).toContain("location /api/health");
    expect(result.nodeIds.some((id) => id.startsWith("route-"))).toBe(true);
  });

  it("uses first matching regex after normal prefix matching", () => {
    const graph = buildTopology(`
      http {
        server {
          listen 80;
          server_name example.com;
          location /assets { return 200; }
          location ~ \\.php$ { return 404; }
        }
      }
    `);

    const result = simulateRequest(graph.routing, graph.edges, {
      host: "example.com",
      path: "/assets/index.php",
      scheme: "http",
      port: 80
    });

    expect(result.status).toBe("matched");
    expect(result.summary).toContain("location \\.php$");
  });

  it("marks dynamic variable routes as low confidence", () => {
    const graph = buildTopology(`
      http {
        map $host $backend { default app; }
        server {
          listen 80;
          server_name example.com;
          location /api { proxy_pass http://$backend; }
        }
      }
    `);

    const result = simulateRequest(graph.routing, graph.edges, {
      host: "example.com",
      path: "/api/users",
      scheme: "http",
      port: 80
    });

    expect(result.status).toBe("matched");
    expect(result.confidence).toBe("low");
    expect(result.reasons).toContain("Dynamic variable target lowers confidence.");
  });

  it("returns no highlighted route when the requested port is empty or unmatched", () => {
    const graph = buildTopology(`
      http {
        server {
          listen 80;
          server_name example.com;
          location / { return 200; }
        }
      }
    `);

    const emptyPort = simulateRequest(graph.routing, graph.edges, {
      host: "example.com",
      path: "/",
      scheme: "http"
    });
    const missingPort = simulateRequest(graph.routing, graph.edges, {
      host: "example.com",
      path: "/",
      scheme: "http",
      port: 9000
    });

    expect(emptyPort.status).toBe("no-server");
    expect(emptyPort.nodeIds).toEqual([]);
    expect(missingPort.status).toBe("no-server");
    expect(missingPort.nodeIds).toEqual([]);
  });

  it("uses host to choose between server_name values on the same port", () => {
    const graph = buildTopology(`
      http {
        server {
          listen 80;
          server_name app.example.com;
          location / { return 200; }
        }
        server {
          listen 80;
          server_name api.example.com;
          location /v1 { return 200; }
        }
      }
    `);

    const result = simulateRequest(graph.routing, graph.edges, {
      host: "api.example.com",
      path: "/v1/users",
      scheme: "http",
      port: 80
    });

    expect(result.status).toBe("matched");
    expect(result.summary).toContain("api.example.com/v1/users");
    expect(result.reasons).toContain("Server name matched api.example.com.");
  });
});
