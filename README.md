# Nginx UI Topology

> 上传 `nginx -T` 输出，查看解析后的配置，在浏览器中探索带动画的路由拓扑。

[English](README-en.md)

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=fff)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=fff)
![Local First](https://img.shields.io/badge/Privacy-local--first-22c55e)
![License](https://img.shields.io/badge/License-Apache--2.0-blue)

Nginx UI Topology 是一个本地优先的 Web 工具，用于可视化 Nginx 路由行为。粘贴或上传 `nginx -T` 的输出，然后在交互式拓扑画布中查看服务器、location、upstream、后端目标、变量和请求流向。

## 截图

### 深色模式

![Nginx UI 深色模式拓扑](src/image/black.png)

### 浅色模式

![Nginx UI 浅色模式拓扑](src/image/white.png)

## 功能

- 直接在浏览器中上传或编辑 `nginx -T` 输出。
- 带语法高亮的 Nginx 配置编辑器，实时更新拓扑。
- 交互式 React Flow 画布，支持缩放、平移、小地图、适配视图和布局旋转。
- 可视化节点：入口、服务器、路由、upstream、动态变量和后端目标。
- 带动画的数据流边线，选中时高亮，无关节点自动淡化。
- 拖动节点重新排列拓扑，带有平滑的 lerp 跟随效果。
- 配置分析，检测常见问题和错误配置。
- 请求路由模拟：输入 host、path、协议和端口，开启实时模拟后静态预览可能命中的 server、location 和后端路径。
- Location 匹配优先级展示，区分精确匹配、优先前缀、正则和普通前缀。
- 详情面板，展示选中节点和边线的源指令及行号信息。
- 导出拓扑为 PNG 或 JSON。
- 双语界面：英文和中文。
- 本地优先处理：配置内容不会上传到服务器。

## 配置分析

内置分析器在解析 AST 后实时检查并报告问题。问题显示在左侧面板中，按严重程度排序（`错误` > `警告` > `提示`），附带源文件行号，点击即可跳转到编辑器对应位置。

### 检测规则

| 严重程度 | 检测项 | 说明 |
|----------|--------|------|
| 警告 | 空 upstream | `upstream` 块中没有 `server` 指令。 |
| 警告 | 缺少 `listen` | `server` 块中没有 `listen` 指令。 |
| 警告 | 重复 `listen` | 同一 `server` 块中有多个 `listen` 指令使用相同的地址和端口。 |
| 警告 | 未定义的 upstream | `proxy_pass`（或 `fastcgi_pass`、`grpc_pass` 等）引用了一个从未定义的 upstream 名称。 |
| 警告 | 重复的 upstream 名称 | 多个 `upstream` 块使用了相同的名称。 |
| 警告 | 重复后端 | 同一 `upstream` 中重复声明相同 backend。 |
| 警告 | TLS 配置不完整 | 例如 `listen 443` 缺少 `ssl`，或启用 SSL 但缺少 `ssl_certificate`。 |
| 警告 | 重复 `server_name` | 同一 listen 范围内重复使用同一个 `server_name`。 |
| 提示 | 缺少 `server_name` | HTTP `server` 块中没有 `server_name` 指令。 |
| 提示 | 使用了 `if` 指令 | `server` 或 `location` 块中包含 `if` 指令，这是已知的意外行为来源。 |
| 提示 | 无终止路由 | `location` 块中没有 `proxy_pass`、`return`、`try_files` 等决定响应的指令。 |
| 提示 | `proxy_pass` URI 风险 | 前缀 `location` 转发到带 URI 的 `proxy_pass` 目标，提示检查 Nginx URI 替换行为。 |

## 快速开始

```bash
npm install
npm run dev
```

打开 Vite 打印的本地开发地址，通常是：

```text
http://localhost:5173/
```

## 使用方法

1. 在安装了 Nginx 的机器上运行 `nginx -T`。
2. 上传生成的输出，或粘贴到左侧配置编辑器中。
3. 在问题面板中查看配置问题，点击问题可跳转到源码对应行。
4. 使用搜索查找服务器名称、upstream、后端或指令。
5. 使用请求路由模拟输入 host、path、协议和端口，开启实时模拟后查看静态推断的命中路径。
6. 点击节点或边线查看详情。
7. 拖动节点重新排列拓扑布局。
8. 使用 **旋转布局** 在从左到右和从上到下的拓扑布局之间切换。
9. 需要时将结果导出为 PNG 或 JSON。

## 支持的 Nginx 概念

解析器从 Nginx 风格的块和指令构建轻量级 AST，然后从常见路由原语推导出拓扑模型：

- `http`、`server`、`location`、`upstream`、`stream` 和 `map`
- `listen`、`server_name` 和 upstream `server`
- `proxy_pass`、`fastcgi_pass`、`grpc_pass`、`uwsgi_pass`、`scgi_pass` 和 `memcached_pass`
- `rewrite`、`return` 和 `try_files`
- 动态目标，例如 `proxy_pass http://$backend`

对于 Lua、njs、深度动态变量和完整的 Nginx location 优先级模拟等复杂运行时行为，系统会在可能的情况下进行可视化表示，但不作为精确的 Nginx 运行时模拟器。

## 脚本命令

```bash
npm run dev      # 启动 Vite 开发服务器
npm run build    # 类型检查并构建生产版本
npm test         # 运行 Vitest 测试
npm run preview  # 预览生产构建
```

## 技术栈

- React + TypeScript
- Vite
- React Flow
- Lucide React 图标
- html-to-image
- Vitest

## 隐私

所有解析和渲染均在浏览器中完成。应用不需要后端服务，也不会上传 Nginx 配置内容。

## 许可证

Apache-2.0。详见 [LICENSE](LICENSE)。
