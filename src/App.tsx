import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import ReactFlow, { Background, ControlButton, Controls, MiniMap, Panel, ReactFlowProvider, useReactFlow, applyNodeChanges, type Edge, type Node, type OnNodesChange } from "reactflow";
import "reactflow/dist/style.css";
import { Download, FileJson, Github, Languages, Maximize, Maximize2, Minimize, Moon, PanelLeftClose, PanelLeftOpen, Pause, Play, RefreshCcw, RefreshCw, Search, Sun, Upload } from "lucide-react";
import { toPng } from "html-to-image";
import { buildTopology, simulateRequest, type ConfigIssue, type IssueSeverity, type RequestSimulationInput, type RequestSimulationResult, type TopologyEdge, type TopologyGraph, type TopologyNode } from "./parser";
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
    simulator: "Request route simulation",
    host: "Host",
    hostPlaceholder: "server_name, e.g. example.com",
    path: "Path",
    scheme: "Scheme",
    port: "Port",
    simulate: "Live simulation",
    simulationOn: "Live simulation on",
    simulationOff: "Live simulation off",
    simulationConfidence: "Static confidence",
    simulationEmpty: "Turn on live simulation to preview the likely Nginx route.",
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
    simulator: "请求路由模拟",
    host: "主机",
    hostPlaceholder: "server_name，例如 example.com",
    path: "路径",
    scheme: "协议",
    port: "端口",
    simulate: "实时模拟",
    simulationOn: "实时模拟已开启",
    simulationOff: "实时模拟已关闭",
    simulationConfidence: "静态置信度",
    simulationEmpty: "开启实时模拟后，预览可能命中的 Nginx 路由。",
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
    "location.missingTerminalRoute": "Location \"{path}\" has no recognized terminal routing directive.",
    "server.listen443WithoutSsl": "Listen directive uses port 443 without the ssl flag: {value}.",
    "server.sslMissingCertificate": "SSL-enabled server has no ssl_certificate directive.",
    "server.duplicateServerName": "Duplicate server_name on the same listen scope: {name}.",
    "upstream.duplicateBackend": "Upstream \"{name}\" repeats backend \"{target}\".",
    "location.proxyPassUriWithPrefix": "Prefix location \"{path}\" proxies to a URI target \"{target}\".",
    "location.duplicate": "Duplicate location declaration: {path}."
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
    "location.missingTerminalRoute": "location “{path}” 没有识别到终结路由指令。",
    "server.listen443WithoutSsl": "listen 指令使用 443 端口但缺少 ssl 标记：{value}。",
    "server.sslMissingCertificate": "启用 SSL 的 server 缺少 ssl_certificate 指令。",
    "server.duplicateServerName": "同一 listen 范围内重复 server_name：{name}。",
    "upstream.duplicateBackend": "upstream “{name}” 重复后端 “{target}”。",
    "location.proxyPassUriWithPrefix": "前缀 location “{path}” 转发到带 URI 的目标 “{target}”。",
    "location.duplicate": "重复的 location 声明：{path}。"
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
    "location.addTerminalRoute": "Add proxy_pass, return, try_files, or another terminal pass directive.",
    "server.addSslFlag": "Add ssl to the listen directive, or move this server to a non-443 port.",
    "server.addSslCertificate": "Add ssl_certificate and ssl_certificate_key for this TLS server.",
    "server.deduplicateServerName": "Keep one server block per server_name and listen combination.",
    "upstream.deduplicateBackend": "Remove the duplicate backend or make the balancing intent explicit.",
    "location.reviewProxyPassUri": "Review Nginx URI replacement behavior for prefix locations.",
    "location.mergeDuplicate": "Merge the duplicated location blocks or make their match rules distinct."
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
    "location.addTerminalRoute": "补充 proxy_pass、return、try_files 或其他终结路由指令。",
    "server.addSslFlag": "补充 listen ssl 标记，或把该 server 移到非 443 端口。",
    "server.addSslCertificate": "为该 TLS server 补充 ssl_certificate 和 ssl_certificate_key。",
    "server.deduplicateServerName": "同一 server_name 和 listen 组合通常只保留一个 server 块。",
    "upstream.deduplicateBackend": "移除重复后端，或显式说明负载均衡意图。",
    "location.reviewProxyPassUri": "检查前缀 location 下 Nginx URI 替换行为是否符合预期。",
    "location.mergeDuplicate": "合并重复 location，或让匹配规则明确不同。"
  }
} as const;

function Workspace() {
  const [config, setConfig] = useState(sampleConfig);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [language, setLanguage] = useState<Language>("zh");
  const [selected, setSelected] = useState<TopologyNode | TopologyEdge | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [layout, setLayout] = useState<Layout>("horizontal");
  const [statusMessage, setStatusMessage] = useState("");
  const [exportingPng, setExportingPng] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(340);
  const [canvasFocused, setCanvasFocused] = useState(false);
  const [simulationInput, setSimulationInput] = useState<RequestSimulationInput>({
    host: "example.com",
    path: "/api/users",
    scheme: "http",
    port: 80
  });
  const [simulationPort, setSimulationPort] = useState("80");
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CodeEditorHandle>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const { fitView } = useReactFlow();
  const text = copy[language];

  const parsedConfig = useDebouncedValue(config, 180);
  const topologyQuery = useDebouncedValue(query, 120);
  const topologyUpdating = parsedConfig !== config || topologyQuery !== query;
  const graph = useMemo<TopologyGraph>(() => buildTopology(parsedConfig), [parsedConfig]);
  const simulation = useMemo<RequestSimulationResult>(
    () => simulationEnabled
      ? simulateRequest(graph.routing, graph.edges, simulationInput)
      : inactiveSimulation(text.simulationEmpty),
    [graph, simulationEnabled, simulationInput, text.simulationEmpty]
  );
  const elements = useMemo(
    () => toFlowElements(graph, topologyQuery, selectedId, layout, { nodeIds: simulation.nodeIds, edgeIds: simulation.edgeIds, active: simulationEnabled }),
    [graph, topologyQuery, selectedId, layout, simulation, simulationEnabled]
  );
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
          <Panel position="top-left" className="request-simulator" aria-label={text.simulator}>
            <div className="simulator-title">
              <span>{text.simulator}</span>
            </div>
            <label>
              <span>{text.host}</span>
              <input
                value={simulationInput.host}
                aria-label={text.host}
                placeholder={text.hostPlaceholder}
                title={text.hostPlaceholder}
                onChange={(event) => setSimulationInput((value) => ({ ...value, host: event.target.value.trim() }))}
              />
            </label>
            <label>
              <span>{text.path}</span>
              <input
                value={simulationInput.path}
                aria-label={text.path}
                onChange={(event) => setSimulationInput((value) => ({ ...value, path: event.target.value }))}
              />
            </label>
            <label>
              <span>{text.scheme}</span>
              <select
                value={simulationInput.scheme}
                aria-label={text.scheme}
                onChange={(event) => {
                  const scheme = event.target.value as RequestSimulationInput["scheme"];
                  setSimulationPort((port) => {
                    if (scheme === "https" && port === "80") return "443";
                    if (scheme === "http" && port === "443") return "80";
                    return port;
                  });
                  setSimulationInput((value) => ({
                    ...value,
                    scheme,
                    port: scheme === "https" && value.port === 80 ? 443 : scheme === "http" && value.port === 443 ? 80 : value.port
                  }));
                }}
              >
                <option value="http">http</option>
                <option value="https">https</option>
              </select>
            </label>
            <label className="simulator-port">
              <span>{text.port}</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={simulationPort}
                aria-label={text.port}
                onChange={(event) => {
                  const { displayValue, port } = parsePortInput(event.target.value);
                  setSimulationPort(displayValue);
                  setSimulationInput((value) => ({ ...value, port }));
                }}
              />
            </label>
            <button
              type="button"
              aria-label={text.simulate}
              title={text.simulate}
              aria-pressed={simulationEnabled}
              className="simulator-live-toggle"
              onClick={() => {
                setSimulationEnabled((enabled) => {
                  const next = !enabled;
                  setStatusMessage(next ? text.simulationOn : text.simulationOff);
                  return next;
                });
              }}
            >
              {simulationEnabled ? <Pause size={14} /> : <Play size={14} />}
              <span className="sr-only">{simulationEnabled ? text.simulationOn : text.simulationOff}</span>
            </button>
          </Panel>
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
        <DetailPanel selected={selected} graph={graph} language={language} simulation={simulation} />
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

function DetailPanel({ selected, graph, language, simulation }: { selected: TopologyNode | TopologyEdge | null; graph: TopologyGraph; language: Language; simulation: RequestSimulationResult }) {
  const text = copy[language];
  if (!selected) {
    return (
      <div className="empty-detail">
        <h2>{text.details}</h2>
        <p>{text.detailsEmpty}</p>
        <SimulationSummary simulation={simulation} language={language} />
      </div>
    );
  }

  const isNode = "details" in selected;
  const related = isNode ? graph.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id) : [];

  return (
    <div className="detail-content">
      <span className="detail-kind">{selected.type}</span>
      <h2>{isNode ? selected.label : selected.label || text.flowEdge}</h2>
      <SimulationSummary simulation={simulation} language={language} compact />
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

function SimulationSummary({ simulation, language, compact = false }: { simulation: RequestSimulationResult; language: Language; compact?: boolean }) {
  const text = copy[language];
  return (
    <section className={`simulation-summary ${compact ? "compact" : ""}`} aria-label={text.simulator}>
      <div className="simulation-summary__top">
        <strong>{translateSimulation(simulation.summary, language)}</strong>
        <span>{text.simulationConfidence}: {text.confidenceValue[simulation.confidence]}</span>
      </div>
      {!compact ? (
        <ul>
          {simulation.reasons.map((reason) => (
            <li key={reason}>{translateSimulation(reason, language)}</li>
          ))}
        </ul>
      ) : null}
    </section>
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
  if (value.startsWith("Location match: ")) return `匹配规则：${translateLocationKind(value.slice(16))}`;
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
    || value.startsWith("Location match: ")
    || value.startsWith("Entry point declared by ")
    || value.startsWith("Dynamic expression: ")
    || value.startsWith("Target declared by ")
    || value.startsWith("map from ");
}

function translateSimulation(value: string, language: Language) {
  if (language === "en") return value;
  return value
    .replace(/^Turn on live simulation to preview the likely Nginx route\.$/, "开启实时模拟后，预览可能命中的 Nginx 路由。")
    .replace(/^Enter a port to simulate the request route\.$/, "输入端口后才能模拟请求路由。")
    .replace(/^No HTTP server matched (.+)\.$/, "没有 HTTP server 匹配 $1。")
    .replace(/^Matched server (.+), but no location matched (.+)\.$/, "已匹配 server $1，但没有 location 匹配 $2。")
    .replace(/^(.+) matched location (.+) in (.+)\.$/, "$1 命中 $3 中的 location $2。")
    .replace(/^Listen matched port (\d+)\.$/, "listen 匹配端口 $1。")
    .replace(/^Server name matched (.+)\.$/, "server_name 匹配 $1。")
    .replace(/^Server has no explicit server_name\.$/, "server 没有显式 server_name。")
    .replace(/^No matching location block found\.$/, "没有找到匹配的 location 块。")
    .replace(/^Fallback\/default server matched\.$/, "命中 fallback/default server。")
    .replace(/^Location matched by (.+): (.+)\.$/, (_, kind, pattern) => `location 通过 ${translateLocationKind(kind)} 匹配：${pattern}。`)
    .replace(/^Dynamic variable target lowers confidence\.$/, "动态变量目标降低置信度。")
    .replace(/^Static route target resolved\.$/, "静态路由目标已解析。")
    .replace(/^Routing model unavailable\.$/, "路由模型不可用。");
}

function translateLocationKind(value: string) {
  return value
    .replace("exact", "精确")
    .replace("prefix-priority", "优先前缀")
    .replace("regex-case-sensitive", "区分大小写正则")
    .replace("regex-case-insensitive", "不区分大小写正则")
    .replace("prefix", "普通前缀");
}

function parsePortInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return { displayValue: "", port: undefined };
  const port = Math.min(65535, Math.max(1, Number(digits)));
  return { displayValue: String(port), port };
}

function inactiveSimulation(summary: string): RequestSimulationResult {
  return {
    status: "no-server",
    confidence: "low",
    nodeIds: [],
    edgeIds: [],
    summary,
    reasons: [summary]
  };
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
