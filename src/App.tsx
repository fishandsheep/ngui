import { useCallback, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Panel, ReactFlowProvider, useReactFlow, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { Download, FileJson, Maximize2, Moon, PanelLeftClose, PanelLeftOpen, RefreshCcw, Search, Sun, Upload } from "lucide-react";
import { toPng } from "html-to-image";
import { buildTopology, type TopologyEdge, type TopologyGraph, type TopologyNode } from "./parser";
import { sampleConfig } from "./sampleConfig";
import { NginxNode } from "./components/NginxNode";
import { CodeEditor } from "./components/CodeEditor";
import { FlowEdge } from "./components/FlowEdge";
import { toFlowElements } from "./graphLayout";
import "./styles.css";

const nodeTypes = { nginxNode: NginxNode };
const edgeTypes = { flowEdge: FlowEdge };

function Workspace() {
  const [config, setConfig] = useState(sampleConfig);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [selected, setSelected] = useState<TopologyNode | TopologyEdge | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  const graph = useMemo<TopologyGraph>(() => buildTopology(config), [config]);
  const elements = useMemo(() => toFlowElements(graph, query, selectedId), [graph, query, selectedId]);

  const onFile = async (file?: File) => {
    if (!file) return;
    setConfig(await file.text());
    setSelected(null);
    setSelectedId(undefined);
  };

  const onNodeClick = (_: unknown, node: Node) => {
    setSelected(node.data as TopologyNode);
    setSelectedId(node.id);
  };

  const onEdgeClick = (_: unknown, edge: Edge) => {
    setSelected(edge.data as TopologyEdge);
    setSelectedId(undefined);
  };

  const exportJson = () => {
    downloadBlob("nginx-topology.json", JSON.stringify(graph, null, 2), "application/json");
  };

  const exportPng = useCallback(async () => {
    const viewport = flowRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!viewport) return;
    const url = await toPng(viewport, { backgroundColor: theme === "dark" ? "#0b1020" : "#f7f8fb", pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = "nginx-topology.png";
    link.href = url;
    link.click();
  }, [theme]);

  return (
    <div className={`app-shell ${theme} ${leftCollapsed ? "panel-collapsed" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>Nginx UI</span>
        </div>
        <nav className="menu">
          <button title="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button title="Export JSON" onClick={exportJson}><FileJson size={16} /></button>
          <button title="Export PNG" onClick={exportPng}><Download size={16} /></button>
        </nav>
      </header>

      <aside className="left-panel">
        <button className="collapse-button" title={leftCollapsed ? "Expand config panel" : "Collapse config panel"} onClick={() => setLeftCollapsed((value) => !value)}>
          {leftCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>

        <div className="panel-content">
          <div className="panel-tools">
            <label className="icon-upload" title="Upload nginx -T output">
              <Upload size={17} />
              <input type="file" accept=".conf,.txt,text/plain" onChange={(event) => onFile(event.target.files?.[0])} />
            </label>
            <button title="Load sample config" onClick={() => setConfig(sampleConfig)}><RefreshCcw size={16} /></button>
            <div className="search-box">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search server, upstream, backend..." />
            </div>
          </div>

          <div className="status-grid">
            <div><strong>{graph.nodes.length}</strong><span>nodes</span></div>
            <div><strong>{graph.edges.length}</strong><span>edges</span></div>
            <div><strong>{graph.errors.length}</strong><span>issues</span></div>
          </div>

          {graph.errors.length > 0 && (
            <div className="issues">
              {graph.errors.slice(0, 5).map((error, index) => (
                <p key={`${error.message}-${index}`}>L{error.loc.line}: {error.message}</p>
              ))}
            </div>
          )}

          <CodeEditor value={config} onChange={setConfig} />
        </div>
      </aside>

      <main className="canvas" ref={flowRef}>
        <ReactFlow
          nodes={elements.nodes}
          edges={elements.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.15}
          maxZoom={1.8}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => {
            setSelected(null);
            setSelectedId(undefined);
          }}
        >
          <Background gap={28} size={1} />
          <MiniMap pannable zoomable />
          <Controls />
          <Panel position="top-right" className="canvas-actions">
            <button title="Fit view" onClick={() => fitView({ padding: 0.16, duration: 300 })}><Maximize2 size={16} /></button>
            <button title="Rebuild layout" onClick={() => setSelectedId(undefined)}><RefreshCcw size={16} /></button>
          </Panel>
        </ReactFlow>
      </main>

      <aside className="right-panel">
        <DetailPanel selected={selected} graph={graph} />
      </aside>
    </div>
  );
}

function DetailPanel({ selected, graph }: { selected: TopologyNode | TopologyEdge | null; graph: TopologyGraph }) {
  if (!selected) {
    return (
      <div className="empty-detail">
        <h2>Topology details</h2>
        <p>Select a node or edge to inspect source directives, line numbers, and connected flow.</p>
      </div>
    );
  }

  const isNode = "details" in selected;
  const related = isNode ? graph.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id) : [];

  return (
    <div className="detail-content">
      <span className="detail-kind">{isNode ? selected.type : selected.type}</span>
      <h2>{isNode ? selected.label : selected.label || "flow edge"}</h2>
      {isNode && selected.subtitle && <p className="subtitle">{selected.subtitle}</p>}
      {isNode && selected.source && (
        <p className="line">Line {selected.source.line}{selected.source.file ? ` in ${selected.source.file}` : ""}</p>
      )}
      {isNode && selected.confidence && <p className="confidence-note">Confidence: {selected.confidence}</p>}
      <pre>{isNode ? selected.raw : selected.sourceRaw || selected.label}</pre>
      {isNode && (
        <>
          <h3>Directives</h3>
          <ul>{selected.details.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Connected flow</h3>
          <ul>{related.length ? related.map((edge) => <li key={edge.id}>{edge.source} {"->"} {edge.target}</li>) : <li>No connected edges.</li>}</ul>
        </>
      )}
    </div>
  );
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  );
}
