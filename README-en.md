# Nginx UI Topology

> Upload `nginx -T` output, inspect the parsed configuration, and explore an animated routing topology in the browser.

[中文文档](README.md)

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=fff)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=fff)
![Local First](https://img.shields.io/badge/Privacy-local--first-22c55e)
![License](https://img.shields.io/badge/License-Apache--2.0-blue)

Nginx UI Topology is a local-first web tool for visualizing nginx routing behavior. Paste or upload the output from `nginx -T`, then inspect servers, locations, upstreams, targets, variables, and request flow from an interactive topology canvas.

## Screenshots

### Dark Mode

![Nginx UI dark mode topology](src/image/black.png)

### Light Mode

![Nginx UI light mode topology](src/image/white.png)

## Features

- Upload or edit `nginx -T` output directly in the browser.
- Syntax-highlighted nginx configuration editor with live topology updates.
- Interactive React Flow canvas with zoom, pan, minimap, fit view, and layout rotation.
- Visual nodes for entries, servers, routes, upstreams, dynamic variables, and backend targets.
- Animated data-flow edges with selection highlighting and unrelated-node dimming.
- Drag nodes to rearrange the topology with smooth lerp-based following.
- Configuration analysis that detects common issues and misconfigurations.
- Request route simulation: enter host, path, scheme, and port, then enable live simulation to statically preview the likely server, location, and backend path.
- Location precedence display for exact, priority-prefix, regex, and normal-prefix matches.
- Details panel for selected nodes and edges, including source directives and line information.
- Export topology as PNG or JSON.
- Bilingual interface: English and Chinese.
- Local-first processing: configuration content is not uploaded to a server.

## Configuration Analysis

The built-in analyzer inspects the parsed AST and reports issues in real time. Issues are displayed in the left panel, sorted by severity (`error` > `warning` > `info`), with the source line number and a one-click jump to the editor.

### Detected checks

| Severity | Check | Description |
|----------|-------|-------------|
| Warning | Empty upstream | An `upstream` block has no `server` directives. |
| Warning | Missing `listen` | A `server` block has no `listen` directive. |
| Warning | Duplicate `listen` | Two `listen` directives in the same `server` share the same address and port. |
| Warning | Undefined upstream | A `proxy_pass` (or `fastcgi_pass`, `grpc_pass`, etc.) references an upstream name that is never defined. |
| Warning | Duplicate upstream name | Multiple `upstream` blocks share the same name. |
| Warning | Duplicate backend | The same backend target is repeated inside one `upstream`. |
| Warning | Incomplete TLS configuration | For example, `listen 443` without `ssl`, or an SSL-enabled server without `ssl_certificate`. |
| Warning | Duplicate `server_name` | The same `server_name` appears more than once in the same listen scope. |
| Info | Missing `server_name` | An HTTP `server` block has no `server_name` directive. |
| Info | `if` directive usage | A `server` or `location` block contains an `if` directive, which is a known source of unexpected behavior. |
| Info | No terminal route | A `location` block has no `proxy_pass`, `return`, `try_files`, or similar directive that determines the response. |
| Info | `proxy_pass` URI risk | A prefix `location` proxies to a `proxy_pass` target with a URI, prompting review of nginx URI replacement behavior. |

## Quick Start

```bash
npm install
npm run dev
```

Open the local development URL printed by Vite, usually:

```text
http://localhost:5173/
```

## Usage

1. Run `nginx -T` on a machine with nginx installed.
2. Upload the generated output or paste it into the left configuration editor.
3. Review configuration issues in the issues panel. Click an issue to jump to the source line.
4. Use search to find server names, upstreams, backends, or directives.
5. Use request route simulation to enter host, path, scheme, and port, then enable live simulation to inspect the statically inferred route.
6. Click nodes or edges to inspect details.
7. Drag nodes to rearrange the topology layout.
8. Use **Rotate layout** to switch between left-to-right and top-to-bottom topology layouts.
9. Export the result as PNG or JSON when needed.

## Supported Nginx Concepts

The parser builds a lightweight AST from nginx-style blocks and directives, then derives a topology model from common routing primitives:

- `http`, `server`, `location`, `upstream`, `stream`, and `map`
- `listen`, `server_name`, and upstream `server`
- `proxy_pass`, `fastcgi_pass`, `grpc_pass`, `uwsgi_pass`, `scgi_pass`, and `memcached_pass`
- `rewrite`, `return`, and `try_files`
- Dynamic targets such as `proxy_pass http://$backend`

Complex runtime behavior such as Lua, njs, deeply dynamic variables, and full nginx location precedence simulation is represented visually where possible, but is not treated as an exact nginx runtime emulator.

## Scripts

```bash
npm run dev      # start the Vite dev server
npm run build    # type-check and build for production
npm test         # run Vitest tests
npm run preview  # preview the production build
```

## Tech Stack

- React + TypeScript
- Vite
- React Flow
- Lucide React icons
- html-to-image
- Vitest

## Privacy

All parsing and rendering happens in the browser. The app does not require a backend service and does not upload nginx configuration content.

## License

Apache-2.0. See [LICENSE](LICENSE).
