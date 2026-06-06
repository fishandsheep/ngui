---
name: Nginx UI Topology
description: 面向 Nginx 路由分析的紧凑型本地拓扑工作台
colors:
  graphite-bg: "#0b1020"
  graphite-panel: "#101827"
  graphite-raised: "#151f32"
  graphite-line: "#26344e"
  graphite-muted: "#8ea0bc"
  graphite-text: "#e7edf7"
  route-green: "#49d6a6"
  topology-blue: "#5ea2ff"
  warning-amber: "#f7bd5c"
  danger-red: "#ff7b7b"
  light-bg: "#f7f8fb"
  light-panel: "#ffffff"
  light-raised: "#f0f3f8"
  light-line: "#d8e0ec"
  light-muted: "#65758c"
  light-text: "#172033"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
  code:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  control: "6px"
  surface: "8px"
  pill: "999px"
spacing:
  xs: "5px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "18px"
components:
  button-default:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.graphite-text}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 10px"
  button-hover:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.route-green}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 10px"
  search-field:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.graphite-text}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 10px"
  topology-node:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.graphite-text}"
    rounded: "{rounded.surface}"
    padding: "10px 12px"
    width: "216px"
---

# Design System: Nginx UI Topology

## 1. Overview

**Creative North Star: “网络控制台”**

界面应像一台专门用于追踪请求路径的网络控制台：信息密集但不拥挤，技术感来自真实数据、结构和状态，而不是装饰。三栏工作区把配置输入、拓扑画布和对象详情放在稳定位置，用户可以持续编辑、定位和验证路由关系。

系统以深色模式为主要工作环境，同时提供语义一致的浅色模式。视觉层级主要依靠背景色阶、细边框、字号和留白建立。避免营销页式表达、霓虹渐变、装饰性玻璃效果、过度卡片化以及与状态无关的动画。

**Key Characteristics:**

- 紧凑的开发者工具密度
- 画布与请求流优先
- 深浅主题语义一致
- 绿、蓝、琥珀色仅承担操作和状态含义
- 熟悉、可预测的控件与反馈

## 2. Colors

石墨深蓝构成安静的工作环境，路由绿用于主要交互和选择，拓扑蓝用于常规连接关系，琥珀与红色保留给警告和错误。

### Primary

- **路由绿** (`#49d6a6`，浅色 `#138a68`)：品牌标记、交互强调、搜索匹配和选中状态。单个视图中应保持克制，不作为大面积装饰背景。

### Secondary

- **拓扑蓝** (`#5ea2ff`，浅色 `#2368d4`)：常规请求流、语法块和次级信息强调。

### Tertiary

- **警告琥珀** (`#f7bd5c`，浅色 `#a66104`)：解析问题、动态目标和低置信度信息。
- **危险红** (`#ff7b7b`，浅色 `#b82e39`)：错误和破坏性反馈，不用于普通强调。

### Neutral

- **石墨背景** (`#0b1020`)：深色画布与应用底层。
- **石墨面板** (`#101827`)：顶部栏和左右面板。
- **抬升石墨** (`#151f32`)：状态块、详情代码和局部分组。
- **结构线** (`#26344e`)：边框、分隔线和控件轮廓。
- **主要文本** (`#e7edf7`)：标题、标签和关键数据。
- **辅助文本** (`#8ea0bc`)：说明、元数据和次级标签。
- **浅色背景** (`#f7f8fb`) 与 **浅色面板** (`#ffffff`)：浅色主题基础表面。
- **浅色主要文本** (`#172033`) 与 **浅色辅助文本** (`#65758c`)：保持 AA 对比度的文本层级。

**状态颜色规则。** 颜色必须与文字、图标、形状或线型共同表达状态，不允许只靠颜色区分节点类型、错误或选择状态。

## 3. Typography

**Display Font:** Inter（回退至系统无衬线字体）
**Body Font:** Inter（回退至系统无衬线字体）
**Label/Mono Font:** SFMono-Regular、Consolas、Liberation Mono

**Character:** 单一无衬线家族提供稳定、熟悉的工具界面体验；等宽字体只用于配置、指令和机器可读内容。层级通过字重、字号和颜色建立，不使用展示型字体。

### Hierarchy

- **Headline**（700，19px，1.25）：详情标题和主要面板标题。
- **Title**（700，约 16px，1.25）：节点名称、品牌名称和关键局部标题。
- **Body**（400，13px，1.55）：说明、详情内容和列表。
- **Label**（400，11–12px，1.35）：控件标签、节点类型、状态和元数据；大写仅用于短类型标记。
- **Code**（400，12px，1.55）：配置编辑器、原始指令和代码片段。

**工具字体规则。** 控件、标签和数据使用固定 rem/px 层级，不使用流式 `clamp()` 大标题；长说明控制在 65–75ch 内。

## 4. Elevation

系统以色调分层和结构线为主，默认表面不依赖阴影。只有需要与无限画布明确分离的浮动元素可使用小范围阴影；静态面板、按钮和输入框保持扁平。

### Shadow Vocabulary

- **画布浮层** (`0 4px 8px rgba(0, 0, 0, 0.20)`)：仅用于确实悬浮于拓扑画布之上的菜单、提示或拖动对象。

**扁平优先规则。** 不把 `1px` 边框与宽度超过 `8px` 的柔和阴影同时用于静态组件。深度优先通过背景色阶和边界表达。

## 5. Components

### Buttons

- **Shape:** 6px 圆角，最小触控尺寸 36×34px。
- **Default:** `--button` 背景、`--line` 边框、`--text` 图标或文字。
- **Hover:** 悬停转为路由绿，并保持背景与边框反馈一致。
- **Action labels:** 纯图标按钮必须有可访问名称；文字按钮使用“动词 + 对象”。

### Chips

- **Style:** 仅用于边标签、置信度和短状态，使用 999px 圆角、11–12px 字号和紧凑内边距。
- **State:** 选中或警告状态必须配合文本或图标，不用纯色圆点承担唯一含义。

### Cards / Containers

- **Corner Style:** 工具面板和状态块使用 8px 圆角。
- **Background:** 在 `--panel` 与 `--panel-2` 之间建立层次。
- **Shadow Strategy:** 静态容器无阴影，画布浮层遵循 Elevation 规则。
- **Border:** 使用完整的 1px `--line` 边框；节点类型用图标、标题或标签表达，不使用粗侧边色条。
- **Internal Padding:** 紧凑容器 8–12px，详情面板 18px。

### Inputs / Fields

- **Style:** 6–8px 圆角、1px 结构线、面板背景；搜索框高度 40px。
- **Error / Disabled:** 错误同时显示文字说明；禁用状态降低强调但仍需满足可读性要求。
- **Placeholder:** 占位文字必须达到正文级对比度，不使用过浅灰色。

### Navigation

顶部栏高度 48px，品牌位于左侧，全局操作位于右侧。桌面端保持三栏结构；1100px 以下隐藏详情栏，760px 以下将配置面板与画布纵向排列。操作图标保持 Lucide 的一致线性风格。

### Topology Node

节点宽 216px，内容按类型、名称、次级信息排列。选择、搜索命中和关联状态使用完整轮廓、图标或标签变化；无关节点可降低透明度，但不得低到无法阅读。节点连接动画只表达流向，并提供减少动态效果替代。

### Code Editor

编辑层与高亮层重叠，使用 12px 等宽字体和 1.55 行高。块、指令、变量和目标使用既定语义颜色；光标、选区和滚动位置必须始终清晰可见。

## 6. Do's and Don'ts

### Do:

- **Do** 保持画布为主要工作区，配置与详情面板服务于路由理解。
- **Do** 在深浅主题中保持相同的状态语义和信息层级。
- **Do** 使用 6px 控件圆角、8px 容器圆角和 8–18px 的紧凑间距体系。
- **Do** 尊重 `prefers-reduced-motion`，将流动边动画替换为静态线型或即时状态变化。
- **Do** 用文字、图标或线型补充颜色含义，并维持 WCAG 2.1 AA 对比度。

### Don't:

- **Don't** 使用营销落地页式的大标题、口号和装饰性数据展示。
- **Don't** 使用霓虹渐变、渐变文字、装饰性玻璃效果或与状态无关的高饱和色。
- **Don't** 为视觉丰富度堆叠卡片、阴影、圆角或无意义动画。
- **Don't** 在卡片、节点、提示或列表项上使用大于 1px 的彩色侧边条。
- **Don't** 同时给静态组件添加 1px 边框与模糊半径大于 8px 的宽阴影。
- **Don't** 发明偏离开发者工具习惯的交互方式，也不要隐藏导入、搜索、布局和导出等关键操作。
- **Don't** 牺牲信息密度、文本可读性或拓扑辨识度来追求视觉效果。
