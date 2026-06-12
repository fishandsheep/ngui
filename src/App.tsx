import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import ReactFlow, { Background, ControlButton, Controls, MiniMap, Panel, ReactFlowProvider, useReactFlow, applyNodeChanges, type Edge, type Node, type OnNodesChange } from "reactflow";
import "reactflow/dist/style.css";
import { Download, FileJson, Github, Languages, Maximize, Maximize2, Minimize, Moon, PanelLeftClose, PanelLeftOpen, RefreshCcw, RefreshCw, Search, Sun, Upload } from "lucide-react";
import { toPng } from "html-to-image";
import { buildTopology, type ConfigIssue, type IssueSeverity, type TopologyEdge, type TopologyGraph, type TopologyNode } from "./parser";
import { sampleConfig } from "./sampleConfig";
import { NginxNode } from "./components/NginxNode";
import { LaneGroup } from "./components/LaneGroup";
import { CodeEditor, type CodeEditorHandle } from "./components/CodeEditor";
import { FlowEdge } from "./components/FlowEdge";
import { toFlowElements } from "./graphLayout";
import "./styles.css";

const nodeTypes = { nginxNode: NginxNode, laneGroup: LaneGroup };
const edgeTypes = { flowEdge: FlowEdge };

type Language = "en" | "zh";
type Layout = "horizontal" | "vertical";

const severityRank: Record<IssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2
};

const copy = {
  en: {
    switchLanguage: "Switch to Chinese",
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
    flowEdge: "flow edge",
    dragEdge: "Drag the lower edge",
    issuePanelHint: "Review parser errors and advisory checks together.",
    jumpToLine: "Click an issue to jump to its configuration line."
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
    inFile: "文件",
    confidence: "置信度",
    confidenceValue: { high: "高", medium: "中", low: "低" },
    directives: "相关指令",
    connectedFlow: "关联流向",
    noConnections: "无关联连线。",
    flowEdge: "拓扑连线",
    dragEdge: "拖动下边界调整高度",
    issuePanelHint: "统一查看解析错误与配置建议。",
    jumpToLine: "点击问题可快速跳转到对应配置行。"
  }
} as const;

const issueMessages = {
  en: {
    "server.missingListen": "Server block has no explicit listen directive.",
    "server.missingServerName": "HTTP server block has no server_name directive.",
    "server.duplicateListen": "Duplicate listen directive: {value}.",
    "upstream.empty": "Upstream \"{name}\" has no backend server entries.",
    "upstream.duplicateName": "Upstream \"{name}\" is defined more than once.",
    "pass.undefinedUpstream": "{directive} references undefined upstream \"{name}\".",
    "server.containsIf": "Server block contains an if block.",
    "location.containsIf": "Location block contains an if block.",
    "location.missingTerminalRoute": "Location \"{path}\" has no recognized terminal routing directive."
  },
  zh: {
    "server.missingListen": "server 块缺少显式 listen 指令。",
    "server.missingServerName": "HTTP server 块没有 server_name 指令。",
    "server.duplicateListen": "存在重复的 listen 指令：{value}。",
    "upstream.empty": "upstream “{name}” 没有任何后端 server 项。",
    "upstream.duplicateName": "upstream “{name}” 被重复定义。",
    "pass.undefinedUpstream": "{directive} 指向未定义的 upstream “{name}”。",
    "server.containsIf": "server 块中包含 if 块。",
    "location.containsIf": "location 块中包含 if 块。",
    "location.missingTerminalRoute": "location “{path}” 没有识别到终结路由指令。"
  }
} as const;

const issueSuggestions = {
  en: {
    "server.addListen": "Add an explicit listen directive to make the entry point unambiguous.",
    "server.addServerName": "Add server_name if this server should answer named hosts.",
    "server.deduplicateListen": "Keep one listen variant per socket unless duplication is intentional.",
    "upstream.addServer": "Add at least one server entry or remove the unused upstream block.",
    "upstream.renameOrMerge": "Merge duplicate upstream blocks or rename them to avoid ambiguity.",
    "pass.defineUpstream": "Define the upstream first, or point the pass directive to a direct host.",
    "server.reviewIf": "Review whether the if block can be replaced with return, map, or location routing.",
    "location.reviewIf": "Review whether the if block can be replaced with return, map, or location routing.",
    "location.addTerminalRoute": "Add proxy_pass, return, try_files, or another terminal pass directive."
  },
  zh: {
    "server.addListen": "补充显式 listen 指令，避免入口语义不明确。",
    "server.addServerName": "如果该 server 需要响应命名主机，请补充 server_name。",
    "server.deduplicateListen": "同一套接字通常保留一条 listen 即可，除非重复是刻意设计。",
    "upstream.addServer": "至少添加一个 server 子项，或移除未使用的 upstream 块。",
    "upstream.renameOrMerge": "合并重复 upstream，或改名以避免歧义。",
    "pass.defineUpstream": "先定义 upstream，或把 pass 目标改成直接主机地址。",
    "server.reviewIf": "评估是否能用 return、map 或 location 路由替代 if。",
    "location.reviewIf": "评估是否能用 return、map 或 location 路由替代 if。",
    "location.addTerminalRoute": "补充 proxy_pass、return、try_files 或其他终结路由指令。"
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
  const [layout, setLayout] = useState<Layout>("horizontal");
  const [statusMessage, setStatusMessage] = useState("");
  const [exportingPng, setExportingPng] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(340);
  const [canvasFocused, setCanvasFocused] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CodeEditorHandle>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const { fitView } = useReactFlow();
  const text = copy[language];

  const parsedConfig = useDebouncedValue(config, 180);
  const topologyQuery = useDebouncedValue(query, 120);
  const topologyUpdating = parsedConfig !== config || topologyQuery !== query;
  const graph = useMemo<TopologyGraph>(() => buildTopology(parsedConfig), [parsedConfig]);
  const elements = useMemo(() => toFlowElements(graph, topologyQuery, selectedId, layout), [graph, topologyQuery, selectedId, layout]);
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setFlowNodes(nds => applyNodeChanges(changes, nds));
  }, []);
  const structureKeyRef = useRef("");

  useEffect(() => {
    const key = graph.nodes.map(n => n.id).join(",") + layout;
    if (key !== structureKeyRef.current) {
      structureKeyRef.current = key;
      setFlowNodes(elements.nodes);
    } else {
      setFlowNodes(prev => {
        const prevById = new Map(prev.map(n => [n.id, n]));
        return elements.nodes.map(computed => {
          const existing = prevById.get(computed.id);
          return existing ? { ...computed, position: existing.position } : computed;
        });
      });
    }
  }, [elements.nodes, graph, layout]);

  const visibleIssues = useMemo(
    () => [...graph.issues].sort(compareIssues).slice(0, 5),
    [graph.issues]
  );

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
      const url = await toPng(viewport, {
        backgroundColor: theme === "dark" ? "#0b1020" : "#f7f8fb",
        pixelRatio: 2
      });
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setStatusMessage(language === "zh" ? "配置面板宽度已更新" : "Configuration panel width updated");
  }, [language]);

  const focusIssueLine = useCallback((line: number) => {
    editorRef.current?.focusLine(line);
    setStatusMessage(language === "zh" ? `已定位到第 ${line} 行` : `Jumped to line ${line}`);
  }, [language]);

  const onIssueKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, line: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    focusIssueLine(line);
  }, [focusIssueLine]);

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
          <button
            className="language-button"
            aria-label={text.switchLanguage}
            title={text.switchLanguage}
            onClick={() => setLanguage((value) => value === "en" ? "zh" : "en")}
          >
            <Languages size={16} />
            <span>{text.languageButton}</span>
          </button>
          <button
            aria-label={theme === "dark" ? text.lightTheme : text.darkTheme}
            aria-pressed={theme === "light"}
            title={theme === "dark" ? text.lightTheme : text.darkTheme}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button aria-label={text.exportJson} title={text.exportJson} onClick={exportJson}>
            <FileJson size={16} />
          </button>
          <button aria-label={text.exportPng} title={text.exportPng} disabled={exportingPng} onClick={exportPng}>
            <Download size={16} />
          </button>
          <button
            className="fullscreen-button"
            aria-label={fullscreen ? text.exitFullscreen : text.enterFullscreen}
            aria-pressed={fullscreen}
            title={fullscreen ? text.exitFullscreen : text.enterFullscreen}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            <span>{fullscreen ? text.exitFullscreen : text.fullscreen}</span>
          </button>
          <a
            href="https://github.com/fishandsheep/ngui"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <Github size={16} />
          </a>
        </nav>
      </header>

      <aside className="left-panel" aria-label={text.configuration}>
        <button
          className="collapse-button"
          aria-label={leftCollapsed ? text.expandConfig : text.collapseConfig}
          aria-expanded={!leftCollapsed}
          aria-controls="config-panel-content"
          title={leftCollapsed ? text.expandConfig : text.collapseConfig}
          onClick={() => setLeftCollapsed((value) => !value)}
        >
          {leftCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>

        <div className="panel-content" id="config-panel-content">
          <div className="panel-tools">
            <label className="icon-upload" title={text.uploadOutput}>
              <Upload size={17} />
              <span className="sr-only">{text.uploadConfig}</span>
              <input type="file" accept=".conf,.txt,text/plain" onChange={(event) => onFile(event.target.files?.[0])} />
            </label>
            <button aria-label={text.loadSample} title={text.loadSample} onClick={() => setConfig(sampleConfig)}>
              <RefreshCcw size={16} />
            </button>
            <div className="search-box">
              <Search size={16} />
              <label className="sr-only" htmlFor="topology-search">{text.search}</label>
              <input
                id="topology-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.searchPlaceholder}
              />
            </div>
          </div>

          <div className="panel-meta">
            <div className="status-grid">
              <div><strong>{graph.nodes.length}</strong><span>{text.nodes}</span></div>
              <div><strong>{graph.edges.length}</strong><span>{text.edges}</span></div>
              <div><strong>{graph.issues.length}</strong><span>{text.issues}</span></div>
            </div>

            {graph.issues.length > 0 && (
              <IssuePanelShell
                ariaLabel={text.issueCount(graph.issues.length)}
                initialHeight={304}
                minHeight={132}
                maxHeight={460}
                background="linear-gradient(180deg, color-mix(in srgb, var(--panel) 82%, var(--accent-2) 18%), color-mix(in srgb, var(--panel-2) 94%, var(--warn) 6%))"
                border="1px solid color-mix(in srgb, var(--warn) 55%, var(--line))"
                header={(
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 10px 8px", borderBottom: "1px solid var(--line)" }}>
                    <strong style={{ color: "var(--text)", fontSize: 12 }}>{text.issues.toUpperCase()}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>{graph.issues.length}</span>
                  </div>
                )}
                helperText={text.dragEdge}
                handleStyle={{ background: "linear-gradient(180deg, transparent, color-mix(in srgb, var(--warn) 38%, var(--accent-2) 62%), transparent)" }}
              >
                <div style={{ padding: "8px 10px 10px", display: "grid", gap: 8 }}>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>{text.issuePanelHint} {text.jumpToLine}</div>
                  {visibleIssues.map((issue) => (
                    <button
                      key={issue.id}
                      type="button"
                      className="issue-item"
                      onClick={() => focusIssueLine(issue.loc.line)}
                      onKeyDown={(event) => onIssueKeyDown(event, issue.loc.line)}
                      title={language === "zh" ? `定位到第 ${issue.loc.line} 行` : `Jump to line ${issue.loc.line}`}
                    >
                      <span className="issue-item__message" style={{ display: "block", fontSize: 13, lineHeight: 1.4, color: "var(--warn)" }}>
                        <strong>[{translateSeverity(issue.severity, language)}]</strong> L{issue.loc.line}: {translateIssue(issue, language)}
                      </span>
                      {issue.suggestionKey ? (
                        <span className="issue-item__suggestion" style={{ display: "block", color: "var(--warn)", fontSize: 12, lineHeight: 1.4, marginTop: 3, opacity: 0.88 }}>
                          {translateIssueSuggestion(issue, language)}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </IssuePanelShell>
            )}
          </div>

          <div className="config-textarea-area">
            <CodeEditor ref={editorRef} value={config} onChange={setConfig} label={text.configuration} />
          </div>
        </div>

        <div
          className="panel-resize-handle"
          onPointerDown={startPanelResize}
          onPointerMove={movePanelResize}
          onPointerUp={finishPanelResize}
          onPointerCancel={finishPanelResize}
        >
          <span />
        </div>
      </aside>

      <main className="canvas" ref={flowRef} aria-label={text.topology} aria-busy={topologyUpdating}>
        <ReactFlow
          nodes={flowNodes}
          edges={elements.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.15}
          maxZoom={1.8}
          onNodesChange={onNodesChange}
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
            <button
              aria-label={canvasFocused ? text.showPanels : text.focusWorkspace}
              aria-pressed={canvasFocused}
              title={canvasFocused ? text.showPanels : text.focusWorkspace}
              onClick={toggleCanvasFocus}
            >
              {canvasFocused ? <Minimize size={16} /> : <Maximize2 size={16} />}
            </button>
            <button aria-label={text.clearSelection} title={text.clearSelection} onClick={() => { setSelectedId(undefined); structureKeyRef.current = ""; setFlowNodes(elements.nodes); }}>
              <RefreshCcw size={16} />
            </button>
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

function IssuePanelShell({
  ariaLabel,
  initialHeight = 304,
  minHeight = 132,
  maxHeight = 460,
  background,
  border,
  header,
  helperText,
  children,
  handleStyle
}: {
  ariaLabel: string;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  background: string;
  border: string;
  header?: ReactNode;
  helperText?: ReactNode;
  children: ReactNode;
  handleStyle?: CSSProperties;
}) {
  const [height, setHeight] = useState(initialHeight);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startY: event.clientY, startHeight: height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [height]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const nextHeight = dragRef.current.startHeight + event.clientY - dragRef.current.startY;
    setHeight(Math.max(minHeight, Math.min(maxHeight, nextHeight)));
  }, [maxHeight, minHeight]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div
      className="issues"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      style={{
        display: "grid",
        gridTemplateRows: header ? "auto minmax(0, 1fr) auto" : "minmax(0, 1fr) auto",
        height,
        minHeight,
        maxHeight,
        overflow: "hidden",
        padding: 0,
        border,
        background
      }}
    >
      {header}
      <div style={{ minHeight: 0, overflow: "auto" }}>
        {children}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        title="Resize issues panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "relative",
          width: "100%",
          height: 18,
          cursor: "ns-resize",
          touchAction: "none",
          borderTop: "1px solid var(--line)",
          ...handleStyle
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            insetInline: 14,
            top: 7,
            height: 3,
            borderRadius: 999,
            background: "color-mix(in srgb, var(--warn) 34%, var(--line))"
          }}
        />
        {helperText ? (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: -18,
              color: "var(--muted)",
              fontSize: 11,
              pointerEvents: "none"
            }}
          >
            {helperText}
          </span>
        ) : null}
      </div>
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
      <span className="detail-kind">{selected.type}</span>
      <h2>{isNode ? selected.label : selected.label || text.flowEdge}</h2>
      {isNode && selected.subtitle ? <p className="subtitle">{translateExplanation(selected.subtitle, language)}</p> : null}
      {isNode && selected.source ? <p className="line">{formatLocation(selected.source.line, selected.source.file, language)}</p> : null}
      {isNode && selected.confidence ? <p className="confidence-note">{text.confidence}: {text.confidenceValue[selected.confidence]}</p> : null}
      <pre>{isNode ? selected.raw : selected.sourceRaw || selected.label}</pre>
      {isNode ? (
        <>
          <h3>{text.directives}</h3>
          <ul>
            {selected.details.map((item) => (
              <li className={isLocalizedExplanation(item) ? "localized-explanation" : undefined} key={item}>
                {translateExplanation(item, language)}
              </li>
            ))}
          </ul>
          <h3>{text.connectedFlow}</h3>
          <ul>
            {related.length
              ? related.map((edge) => <li key={edge.id}>{edge.source} {"->"} {edge.target}</li>)
              : <li>{text.noConnections}</li>}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function compareIssues(left: ConfigIssue, right: ConfigIssue) {
  return severityRank[left.severity] - severityRank[right.severity] || left.loc.line - right.loc.line || left.loc.column - right.loc.column;
}

function translateSeverity(severity: IssueSeverity, language: Language) {
  if (language === "zh") {
    if (severity === "error") return "错误";
    if (severity === "warning") return "警告";
    return "提示";
  }
  return severity.toUpperCase();
}

function translateIssue(issue: ConfigIssue, language: Language) {
  if (issue.messageKey === "parse.raw") {
    const message = String(issue.params?.message || "");
    return language === "en" ? message : translateParseMessage(message);
  }
  const template = issueMessages[language][issue.messageKey as keyof typeof issueMessages.en] || issue.messageKey;
  return formatTemplate(template, issue.params || {});
}

function translateIssueSuggestion(issue: ConfigIssue, language: Language) {
  if (!issue.suggestionKey) return "";
  const template = issueSuggestions[language][issue.suggestionKey as keyof typeof issueSuggestions.en] || issue.suggestionKey;
  return formatTemplate(template, issue.params || {});
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

function translateParseMessage(message: string) {
  if (message === "Unexpected closing brace") return "出现多余的右花括号";
  const token = message.match(/^Unexpected token "(.+)"$/);
  if (token) return `出现意外标记“${token[1]}”`;
  const directive = message.match(/^Directive "(.+)" is missing ";" or "\{"$/);
  if (directive) return `指令“${directive[1]}”缺少“;”或“{”`;
  const block = message.match(/^Unclosed block "(.+)"$/);
  if (block) return `区块“${block[1]}”未闭合`;
  return message;
}

function issueColor(severity: IssueSeverity) {
  if (severity === "error") return "var(--danger)";
  if (severity === "warning") return "var(--warn)";
  return "var(--text)";
}

function formatLocation(line: number, file: string | undefined, language: Language) {
  if (language === "zh") {
    return file ? `第 ${line} 行，文件 ${file}` : `第 ${line} 行`;
  }
  return file ? `Line ${line} in ${file}` : `Line ${line}`;
}

function formatTemplate(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
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
