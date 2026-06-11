import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import ReactFlow, { Background, ControlButton, Controls, MiniMap, Panel, ReactFlowProvider, useReactFlow, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { Download, FileJson, Languages, Maximize, Maximize2, Minimize, Moon, PanelLeftClose, PanelLeftOpen, RefreshCw, RefreshCcw, Search, Sun, Upload } from "lucide-react";
import { toPng } from "html-to-image";
import { buildTopology, type TopologyEdge, type TopologyGraph, type TopologyNode } from "./parser";
import { sampleConfig } from "./sampleConfig";
import { NginxNode } from "./components/NginxNode";
import { LaneGroup } from "./components/LaneGroup";
import { CodeEditor } from "./components/CodeEditor";
import { FlowEdge } from "./components/FlowEdge";
import { toFlowElements } from "./graphLayout";
import "./styles.css";

const nodeTypes = { nginxNode: NginxNode, laneGroup: LaneGroup };
const edgeTypes = { flowEdge: FlowEdge };
type Language = "en" | "zh";

const copy = {
  en: {
    switchLanguage: "切换到中文",
    languageButton: "中文",
    lightTheme: "Switch to light theme",
    darkTheme: "Switch to dark theme",
    exportJson: "Export topology as JSON",
    exportPng: "Export topology as PNG",
    enterFullscreen: "Enter fullscreen",
    exitFullscreen: "Exit fullscreen",
    fullscreen: "Fullscreen",
    configuration: "Nginx configuration",
    expandConfig: "Expand config panel",
    collapseConfig: "Collapse config panel",
    uploadOutput: "Upload nginx -T output",
    uploadConfig: "Upload nginx configuration",
    loadSample: "Load sample configuration",
    search: "Search topology",
    searchPlaceholder: "Search server, upstream, backend...",
    nodes: "nodes",
    edges: "edges",
    issues: "issues",
    issueCount: (count: number) => `${count} configuration issues`,
    topology: "Nginx routing topology",
    rotateLayout: "Rotate layout",
    showPanels: "Show side panels",
    focusWorkspace: "Fullscreen topology workspace",
    clearSelection: "Clear topology selection",
    updating: "Updating topology...",
    details: "Topology details",
    detailsEmpty: "Select a node or edge to inspect source directives, line numbers, and connected flow.",
    line: "Line",
    inFile: "in",
    confidence: "Confidence",
    confidenceValue: { high: "high", medium: "medium", low: "low" },
    directives: "Directives",
    connectedFlow: "Connected flow",
    noConnections: "No connected edges.",
    flowEdge: "flow edge"
  },
  zh: {
    switchLanguage: "Switch to English",
    languageButton: "EN",
    lightTheme: "切换到浅色主题",
    darkTheme: "切换到深色主题",
    exportJson: "导出拓扑 JSON",
    exportPng: "导出拓扑 PNG",
    enterFullscreen: "进入全屏",
    exitFullscreen: "退出全屏",
    fullscreen: "全屏",
    configuration: "Nginx 配置",
    expandConfig: "展开配置面板",
    collapseConfig: "收起配置面板",
    uploadOutput: "上传 nginx -T 输出",
    uploadConfig: "上传 Nginx 配置",
    loadSample: "载入示例配置",
    search: "搜索拓扑",
    searchPlaceholder: "搜索 server、upstream、backend...",
    nodes: "节点",
    edges: "连线",
    issues: "问题",
    issueCount: (count: number) => `${count} 个配置问题`,
    topology: "Nginx 路由拓扑",
    rotateLayout: "切换布局方向",
    showPanels: "显示两侧面板",
    focusWorkspace: "拓扑工作区全屏",
    clearSelection: "清除拓扑选择",
    updating: "正在更新拓扑...",
    details: "拓扑详情",
    detailsEmpty: "选择节点或连线，查看来源指令、行号和关联流向。",
    line: "第",
    inFile: "行，文件",
    confidence: "置信度",
    confidenceValue: { high: "高", medium: "中", low: "低" },
    directives: "相关指令",
    connectedFlow: "关联流向",
    noConnections: "无关联连线。",
    flowEdge: "拓扑连线"
  }
} as const;

function Workspace() {
  const [config, setConfig] = useState(sampleConfig);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [language, setLanguage] = useState<Language>("en");
  const [selected, setSelected] = useState<TopologyNode | TopologyEdge | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [layout, setLayout] = useState<"horizontal" | "vertical">("horizontal");
  const [statusMessage, setStatusMessage] = useState("");
  const [exportingPng, setExportingPng] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(340);
  const [canvasFocused, setCanvasFocused] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const { fitView } = useReactFlow();
  const text = copy[language];
  const parsedConfig = useDebouncedValue(config, 180);
  const topologyQuery = useDebouncedValue(query, 120);
  const topologyUpdating = parsedConfig !== config || topologyQuery !== query;
  const graph = useMemo<TopologyGraph>(() => buildTopology(parsedConfig), [parsedConfig]);
  const elements = useMemo(() => toFlowElements(graph, topologyQuery, selectedId, layout), [graph, topologyQuery, selectedId, layout]);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setConfig(await file.text());
      setSelected(null);
      setSelectedId(undefined);
      setStatusMessage(language === "zh" ? `已载入 ${file.name}` : `Loaded ${file.name}`);
    } catch {
      setStatusMessage(language === "zh" ? `无法读取 ${file.name}，请选择可读取的文本文件。` : `Could not read ${file.name}. Choose a readable text file.`);
    }
  };

  const onNodeClick = (_: unknown, node: Node) => {
    if (node.type !== "nginxNode") return;
    setSelected(node.data as TopologyNode);
    setSelectedId((node.data as TopologyNode & { nodeId?: string }).nodeId || node.id);
  };

  const onEdgeClick = (_: unknown, edge: Edge) => {
    setSelected(edge.data as TopologyEdge);
    setSelectedId(undefined);
  };

  const exportJson = () => {
    downloadBlob("nginx-topology.json", JSON.stringify(graph, null, 2), "application/json");
    setStatusMessage(language === "zh" ? "已导出拓扑 JSON" : "Exported topology as JSON");
  };

  const exportPng = useCallback(async () => {
    const viewport = flowRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!viewport) {
      setStatusMessage(language === "zh" ? "拓扑画布不可用，无法导出 PNG。" : "Could not export PNG because the topology canvas is unavailable.");
      return;
    }
    setExportingPng(true);
    try {
      const url = await toPng(viewport, { backgroundColor: theme === "dark" ? "#0b1020" : "#f7f8fb", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "nginx-topology.png";
      link.href = url;
      link.click();
      setStatusMessage(language === "zh" ? "已导出拓扑 PNG" : "Exported topology as PNG");
    } catch {
      setStatusMessage(language === "zh" ? "PNG 导出失败，请调整拓扑视图后重试。" : "PNG export failed. Try fitting the topology and export again.");
    } finally {
      setExportingPng(false);
    }
  }, [language, theme]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        return;
      }
      await document.exitFullscreen();
    } catch {
      setStatusMessage(language === "zh" ? "当前浏览器环境不支持全屏。" : "Fullscreen is unavailable in this browser context.");
    }
  }, [language]);

  const rotateLayout = useCallback(() => {
    setLayout((value) => value === "horizontal" ? "vertical" : "horizontal");
    window.setTimeout(() => fitView({ padding: 0.16, duration: 300 }), 0);
  }, [fitView]);

  const toggleCanvasFocus = useCallback(() => {
    setCanvasFocused((focused) => !focused);
    window.setTimeout(() => fitView({ padding: 0.12, duration: 260 }), 0);
  }, [fitView]);

  const startPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (leftCollapsed || canvasFocused || window.matchMedia("(max-width: 760px)").matches) return;
    resizeStartRef.current = { x: event.clientX, width: leftPanelWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [canvasFocused, leftCollapsed, leftPanelWidth]);

  const movePanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return;
    const nextWidth = resizeStartRef.current.width + event.clientX - resizeStartRef.current.x;
    setLeftPanelWidth(Math.min(560, Math.max(260, nextWidth)));
  }, []);

  const finishPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return;
    resizeStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setStatusMessage(language === "zh" ? "配置面板宽度已更新" : "Configuration panel width updated");
  }, [language]);

  return (
    <div
      className={`app-shell ${theme} ${leftCollapsed ? "panel-collapsed" : ""} ${canvasFocused ? "canvas-focused" : ""}`}
      style={{ "--left-panel-width": `${leftPanelWidth}px` } as CSSProperties}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>Nginx UI</span>
        </div>
        <nav className="menu" aria-label={language === "zh" ? "工具栏" : "Toolbar"}>
          <button className="language-button" aria-label={text.switchLanguage} title={text.switchLanguage} onClick={() => setLanguage((value) => value === "en" ? "zh" : "en")}><Languages size={16} /><span>{text.languageButton}</span></button>
          <button aria-label={theme === "dark" ? text.lightTheme : text.darkTheme} aria-pressed={theme === "light"} title={theme === "dark" ? text.lightTheme : text.darkTheme} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button aria-label={text.exportJson} title={text.exportJson} onClick={exportJson}><FileJson size={16} /></button>
          <button aria-label={text.exportPng} title={text.exportPng} disabled={exportingPng} onClick={exportPng}><Download size={16} /></button>
          <button className="fullscreen-button" aria-label={fullscreen ? text.exitFullscreen : text.enterFullscreen} aria-pressed={fullscreen} title={fullscreen ? text.exitFullscreen : text.enterFullscreen} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            <span>{fullscreen ? text.exitFullscreen : text.fullscreen}</span>
          </button>
        </nav>
      </header>


      <aside className="left-panel" aria-label={text.configuration}>
        <button className="collapse-button" aria-label={leftCollapsed ? text.expandConfig : text.collapseConfig} aria-expanded={!leftCollapsed} aria-controls="config-panel-content" title={leftCollapsed ? text.expandConfig : text.collapseConfig} onClick={() => setLeftCollapsed((value) => !value)}>
          {leftCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>

        <div className="panel-content" id="config-panel-content">
          <div className="panel-tools">
            <label className="icon-upload" title={text.uploadOutput}>
              <Upload size={17} />
              <span className="sr-only">{text.uploadConfig}</span>
              <input type="file" accept=".conf,.txt,text/plain" onChange={(event) => onFile(event.target.files?.[0])} />
            </label>
            <button aria-label={text.loadSample} title={text.loadSample} onClick={() => setConfig(sampleConfig)}><RefreshCcw size={16} /></button>
            <div className="search-box">
              <Search size={16} />
              <label className="sr-only" htmlFor="topology-search">{text.search}</label>
              <input id="topology-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.searchPlaceholder} />
            </div>
          </div>

          <div className="panel-meta">
            <div className="status-grid">
              <div><strong>{graph.nodes.length}</strong><span>{text.nodes}</span></div>
              <div><strong>{graph.edges.length}</strong><span>{text.edges}</span></div>
              <div><strong>{graph.errors.length}</strong><span>{text.issues}</span></div>
            </div>

            {graph.errors.length > 0 && (
              <div className="issues" role="status" aria-live="polite" aria-label={text.issueCount(graph.errors.length)}>
                {graph.errors.slice(0, 5).map((error, index) => (
                  <p key={`${error.message}-${index}`}>L{error.loc.line}: {translateError(error.message, language)}</p>
                ))}
              </div>
            )}
          </div>

          <div className="config-textarea-area">
            <CodeEditor value={config} onChange={setConfig} label={text.configuration} />
          </div>
        </div>
        <div
          className="panel-resize-handle"
          onPointerDown={startPanelResize}
          onPointerMove={movePanelResize}
          onPointerUp={finishPanelResize}
          onPointerCancel={finishPanelResize}
        ><span /></div>
      </aside>



      <main className="canvas" ref={flowRef} aria-label={text.topology} aria-busy={topologyUpdating}>
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
          <Controls>
            <ControlButton title={text.rotateLayout} onClick={rotateLayout}>
              <RefreshCw size={16} />
            </ControlButton>
          </Controls>
          <Panel position="top-right" className="canvas-actions">
            <button aria-label={canvasFocused ? text.showPanels : text.focusWorkspace} aria-pressed={canvasFocused} title={canvasFocused ? text.showPanels : text.focusWorkspace} onClick={toggleCanvasFocus}>{canvasFocused ? <Minimize size={16} /> : <Maximize2 size={16} />}</button>
            <button aria-label={text.clearSelection} title={text.clearSelection} onClick={() => setSelectedId(undefined)}><RefreshCcw size={16} /></button>
          </Panel>
        </ReactFlow>
        {topologyUpdating && <div className="topology-progress" role="status">{text.updating}</div>}
      </main>


      <aside className="right-panel" aria-label={text.details} aria-live="polite">
        <DetailPanel selected={selected} graph={graph} language={language} />
      </aside>
      <div className="sr-only" role="status" aria-live="polite">{statusMessage}</div>
    </div>
  );
}

function DetailPanel({ selected, graph, language }: { selected: TopologyNode | TopologyEdge | null; graph: TopologyGraph; language: Language }) {
  const text = copy[language];
  if (!selected) {
    return (
      <div className="empty-detail">
        <h2>{text.details}</h2>
        <p>{text.detailsEmpty}</p>
      </div>
    );
  }

  const isNode = "details" in selected;
  const related = isNode ? graph.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id) : [];

  return (
    <div className="detail-content">
      <span className="detail-kind">{isNode ? selected.type : selected.type}</span>
      <h2>{isNode ? selected.label : selected.label || text.flowEdge}</h2>
      {isNode && selected.subtitle && <p className="subtitle">{translateExplanation(selected.subtitle, language)}</p>}
      {isNode && selected.source && (
        <p className="line">{language === "zh" ? `${text.line} ${selected.source.line} ${selected.source.file ? `${text.inFile} ${selected.source.file}` : "行"}` : `${text.line} ${selected.source.line}${selected.source.file ? ` ${text.inFile} ${selected.source.file}` : ""}`}</p>
      )}
      {isNode && selected.confidence && <p className="confidence-note">{text.confidence}: {text.confidenceValue[selected.confidence]}</p>}
      <pre>{isNode ? selected.raw : selected.sourceRaw || selected.label}</pre>
      {isNode && (
        <>
          <h3>{text.directives}</h3>
          <ul>{selected.details.map((item) => <li className={isLocalizedExplanation(item) ? "localized-explanation" : undefined} key={item}>{translateExplanation(item, language)}</li>)}</ul>
          <h3>{text.connectedFlow}</h3>
          <ul>{related.length ? related.map((edge) => <li key={edge.id}>{edge.source} {"->"} {edge.target}</li>) : <li>{text.noConnections}</li>}</ul>
        </>
      )}
    </div>
  );
}

function translateExplanation(value: string, language: Language) {
  if (language === "en") return value;
  if (value === "No explicit listen directive found.") return "未发现显式 listen 指令。";
  if (value === "upstream group") return "upstream 组";
  if (value === "dynamic target") return "动态目标";
  if (value === "route") return "路由";
  if (value.startsWith("Entry point declared by ")) return `入口由 ${value.slice(24)} 声明`;
  if (value.startsWith("Dynamic expression: ")) return `动态表达式：${value.slice(20)}`;
  if (value.startsWith("Target declared by ")) return `目标由 ${value.slice(19)} 声明`;
  if (value.startsWith("map from ")) return `映射来源 ${value.slice(9)}`;
  return value;
}

function isLocalizedExplanation(value: string) {
  return value === "No explicit listen directive found."
    || value === "upstream group"
    || value === "dynamic target"
    || value === "route"
    || value.startsWith("Entry point declared by ")
    || value.startsWith("Dynamic expression: ")
    || value.startsWith("Target declared by ")
    || value.startsWith("map from ");
}

function translateError(message: string, language: Language) {
  if (language === "en") return message;
  if (message === "Unexpected closing brace") return "出现多余的右花括号";
  const token = message.match(/^Unexpected token "(.+)"$/);
  if (token) return `出现意外标记“${token[1]}”`;
  const directive = message.match(/^Directive "(.+)" is missing ";" or "\{"$/);
  if (directive) return `指令“${directive[1]}”缺少“;”或“{”`;
  const block = message.match(/^Unclosed block "(.+)"$/);
  if (block) return `区块“${block[1]}”未闭合`;
  return message;
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

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  );
}
