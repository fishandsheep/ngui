# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Nginx UI Topology — local-first web tool that parses `nginx -T` output and renders an interactive routing topology graph. All processing happens in-browser; no backend.

## Commands

```bash
npm run dev       # Vite dev server on 0.0.0.0:5173
npm run build     # tsc type-check + Vite production build
npm test          # Vitest (jsdom environment)
npm run preview   # Preview production build
```

Run a single test file: `npx vitest run src/parser/parser.test.ts`

## Architecture

### Pipeline: config text → AST → topology → React Flow

1. **Tokenizer** (`src/parser/tokenizer.ts`) — splits raw nginx config into tokens (word, braceOpen, braceClose, semicolon) with source locations.
2. **Parser** (`src/parser/parser.ts`) — builds a tree of `NginxBlock` / `NginxDirective` nodes (AST).
3. **Graph builder** (`src/parser/graph.ts`) — walks the AST and extracts `TopologyGraph` (nodes: entry/server/route/upstream/target/variable; edges: flow/rewrite/map/dynamic).
4. **Config analyzer** (`src/parser/analyzer.ts`) — walks AST detecting issues (empty upstreams, missing listen, duplicate upstream names, unreachable routes). Produces `ConfigIssue[]` surfaced in the topology graph.
5. **Layout** (`src/graphLayout.ts`) — converts `TopologyGraph` into React Flow `Node[]` and `Edge[]`, grouping nodes into server-based lanes. Supports horizontal and vertical layouts, search filtering, and selection-based dimming.

### UI layer

- **App.tsx** — main component. Manages config text, parsed graph, search, selection, theme, language (en/zh), layout direction. Debounced re-parse on editor changes.
- **CodeEditor** (`src/components/CodeEditor.tsx`) — syntax-highlighted textarea for nginx config.
- **NginxNode** (`src/components/NginxNode.tsx`) — custom React Flow node renderer for topology nodes.
- **LaneGroup** (`src/components/LaneGroup.tsx`) — React Flow node for server-group lane headers in the canvas.
- **FlowEdge** (`src/components/FlowEdge.tsx`) — custom animated edge with data-flow markers.
- **styles.css** — dark/light theme via CSS custom properties on `[data-theme="dark"]` / `[data-theme="light"]`.

### Types

All shared types live in `src/parser/types.ts`. Key types: `TopologyGraph`, `TopologyNode`, `TopologyEdge`, `NginxBlock`, `ParseResult`, `ConfigIssue`.

## Key conventions

- Vite base path switches to `/ngui/` under GitHub Actions (`process.env.GITHUB_ACTIONS`).
- Vitest configured in `vite.config.ts` (not a separate config file). Setup file: `src/test/setup.ts`.
- TypeScript strict mode, ES2020 target, ESNext modules with bundler resolution.
- Design tokens in `DESIGN.md` — dark/light color palettes, typography, spacing.
