**English**: [README.md](./README.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/cover.svg">
    <img alt="KWorks — 本地优先的开源 AI 工作区" src="assets/cover.svg" width="100%" />
  </picture>
</p>

# KWorks

> **一个本地优先的桌面 AI 工作区** —— 一个开源、可组合的超级 Agent 平台，将 Electron 壳、Next.js 渲染器与领域中立的 QiongQi 多 Agent 运行时融合为一个自包含的桌面产品。

KWorks 围绕一个核心理念构建：**骨架不变，血肉万变。** 运行时保持领域中立，这样同一套引擎今天可以是编码副驾，明天是研报分析师，后天又是创意工作室 —— 只需替换加载的技能包即可。

---

## ✨ 核心特性

- **本地优先** —— 整套服务跑在 `127.0.0.1`，除非你显式配置远端模型供应商，数据不离开本机。
- **Electron-only 产品入口** —— 开发和运行都通过 `desktop/`；`frontend/` 是渲染器源码和静态导出目标，不再作为独立 Web 应用启动。
- **Cache-first Agent 引擎** —— QiongQi 通过不可变 prompt 前缀、TTL/LRU 缓存、工具目录指纹与上下文压缩，最大化每一 token 的 ROI。
- **可插拔能力矩阵** —— 技能、MCP 服务、Web 工具、记忆、子 Agent 委派，都是 `CapabilityRegistry` 背后的热插拔 Provider。
- **声明式 Loop 工程** —— `LoopRunner` 解释 `LoopPlan` 阶段（`build-prompt → run-model → decide → evaluate → dispatch-tools`），支持有界重试与富事件审计。
- **多 Agent A2A 协议** —— 每个运行时都暴露 `/.well-known/agent-card.json` 与 `/a2a/tasks` 端点，支持跨实例、跨厂商的 Agent 协作。
- **生产级可观测性** —— 开箱即用的 Prometheus 指标、结构化访问日志、W3C `traceparent` 传播与 OpenTelemetry HTTP tracing。
- **混合 SQLite + JSONL 存储** —— Codex 风格的索引性能与全量可读性兼得，并通过 `FileTurnStateStore` 提供崩溃恢复。
- **跨平台桌面打包** —— 一次 `electron-builder` 调用即可将前端、运行时、技能与图标打包为签名后的 macOS / Windows / Linux 应用。
- **中英双语文档** —— 每份主要文档同时提供英文（`.md`）与中文（`.zh.md`）版本。

---

## 🏗️ 架构一览

```
┌──────────────────────────────────────────────────────────────────┐
│                       桌面端 (Electron shell)                     │
│             加载前端构建产物 + 内嵌 qiongqi 运行时                 │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                   前端 (Next.js 16 + React 19)                   │
│        App Router · SSE 流式 · CodeMirror · xterm.js · xyflow    │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTP / SSE  (/v1/* + /a2a/*)
┌──────────────────────────────▼───────────────────────────────────┐
│              QiongQi 运行时 (TypeScript 多 Agent 引擎)            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  http-layer   Router · Auth · SSE · A2A · OTel · Metrics   │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  engine       TurnOrchestrator · LoopRunner · PromptBuilder│  │
│  │               ContextCompactor · ToolCallCoordinator       │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  adapters     model · tools · storage · fs · tool-infra    │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  capabilities skills · memory · attachments · delegation   │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  foundation   contracts · domain · ports · cache           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                        OpenAI 兼容 API
                               │
                   ┌───────────▼───────────┐
                   │    外部 LLM 供应商      │
                   │ (DeepSeek / GLM / ...) │
                   └───────────────────────┘
```

仓库根目录**并非** pnpm workspace —— `qiongqi/`、`frontend/`、`desktop/` 各自是独立的包，拥有各自的 `pnpm-lock.yaml`。受支持的产品入口是 Electron：开发时由 `desktop/` 启动渲染器 dev server，打包时将渲染器静态导出并随桌面应用一起发布。

> **关于 `third_party/`** —— 旧分支可能仍保留 `third_party/qiongqi` 路径。这是迁移遗留物，QiongQi 的唯一有效源码位置在仓库根目录的 `qiongqi/`。新代码不要使用 `third_party/` 路径。

---

## 📁 仓库结构

```text
KWorks/
├── qiongqi/            # QiongQi 多 Agent 运行时（内部 18 个包）
├── frontend/           # Next.js 16 + React 19 Electron 渲染器源码
├── desktop/            # Electron 桌面壳
├── skills/             # 打包进桌面应用的共享 Agent 技能
│   └── public/         # 25+ 公共技能（编码、研究、设计、媒体...）
├── scripts/
│   └── serve.mjs       # 已禁用的旧 Web 栈启动器
├── start.sh            # desktop dev/build 命令的便捷包装
├── logs/               # 运行日志（gateway.log、frontend.log）
├── .pids/              # 受管服务的 PID 文件
├── assets/             # 项目封面图
├── .env                # 本地环境变量配置（勿提交真实密钥）
├── CONTRIBUTING.md     # 贡献指南（英文）
├── CONTRIBUTING.zh.md  # 贡献指南（中文）
└── LICENSE             # MIT
```

---

## 🚀 快速开始

### 前置条件

- **Node.js 22+**（Electron 渲染器工具链必需；运行时支持 Node 20+）
- **pnpm 10+**
- 若要使用 `hybrid` SQLite 存储，需准备可用的 C++ 工具链（macOS 的 Xcode CLT、Linux 的 `build-essential`、Windows 的 Visual Studio Build Tools）

### 1. 在各工作区安装依赖

```bash
cd qiongqi   && pnpm install
cd ../frontend && pnpm install
cd ../desktop   && pnpm install
```

### 2. 以开发模式启动桌面应用

通过 Electron 启动 KWorks。桌面 dev launcher 会编译 main/preload TypeScript、准备 QiongQi 运行时、启动本地 gateway、启动 Next 渲染器 dev server，并打开 Electron 窗口。

```bash
cd desktop
pnpm run dev
```

### 3. 打包桌面应用

```bash
cd desktop
pnpm run build:app
```

`frontend/` 下的 `pnpm dev`、`pnpm start`、`pnpm preview` 等脚本会主动拒绝运行。Next dev server 只能由 `desktop/scripts/dev.mjs` 启动，此时 Electron preload bridge 可用。

---

## ⚙️ 配置说明

### 环境变量（`.env`）

桌面启动器从环境变量和用户数据存储读取配置。关键变量如下：

| 变量名                 | 用途                                                       | 默认值                        |
| ---------------------- | ---------------------------------------------------------- | ----------------------------- |
| `GATEWAY_PORT`         | 桌面端 QiongQi HTTP/SSE 服务端口                           | `19987`                       |
| `QIONGQI_API_KEY`      | 上游 LLM 供应商的 API Key                                  | *(使用真实模型时必填)*        |
| `QIONGQI_BASE_URL`     | OpenAI 兼容供应商的 Base URL                               | `https://api.deepseek.com`    |
| `QIONGQI_MODEL`        | 引导用的默认模型 ID                                        | *(可选)*                      |
| `QIONGQI_DATA_DIR`     | 线程、会话、产物等的根数据目录                             | `~/.kworks-workspace/...`     |
| `QIONGQI_STORAGE_BACKEND` | `file`（JSONL）或 `hybrid`（SQLite + JSONL）            | `file`                        |
| `KWORKS_WORKSPACE_DIR` | 覆盖桌面工作区根目录                                       | *(可选)* |

> **向后兼容**：当 `QIONGQI_*` 变量缺失时，`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 仍可作为别名使用。运行时本身是厂商中立的，DeepSeek 只是历史默认值。

桌面工作区默认位于 `~/.kworks-workspace/`，其中包含 SQLite 数据库、用户记录、线程存储、会话日志、内置技能和运行时产物。

### 运行时配置文件

进阶场景（自定义模型 profile、能力开关、可观测性）下，QiongQi 可接收 JSON 配置文件。完整 schema 见 [`qiongqi/config.example.json`](./qiongqi/config.example.json)，主要字段包括：

- `serve.tokenEconomy` —— 工具描述 / 结果的压缩预算
- `serve.storage.backend` —— `file` 或 `hybrid`
- `serve.observability.openTelemetry` —— OTLP HTTP exporter 设置
- `contextCompaction` —— 软 / 硬阈值与摘要模式
- `capabilities.{mcp,web,skills,subagents,attachments,memory}` —— 各能力的开关与限制

---

## 🧠 技能系统

技能是 Agent 的"血肉"。一个技能是一个目录，包含：

- `skill.json` —— 清单（`specVersion`、`id`、`name`、`commands`、`tools.allowed`、`permissions`，可选 `mcpServers`）
- `SKILL.md` —— 技能激活时注入系统 prompt 的自然语言描述

仓库内置两套技能：

| 位置                  | 数量  | 用途                                                            |
| --------------------- | ----- | --------------------------------------------------------------- |
| `qiongqi/skills/`     | 11    | 引擎内置技能（code-review、debugging、tdd、planning、goal、todo、refactoring、security-review、git-worktrees、web、review） |
| `skills/public/`      | 25+   | 产品级技能（coding、deep-research、image/video/music/podcast/ppt generation、chart-visualization、data-analysis、pdf-processing、vercel-deploy、skill-creator 等） |

技能通过 `createAgent({ skillRoots: [...] })` 发现。桌面打包流程会把 `skills/` 复制进应用包，保证离线环境下也能使用同一套技能。

---

## 🖥️ 桌面端打包

`desktop/` 中的 Electron 壳包裹前端静态产物并内嵌 QiongQi 运行时，使整套产品作为单一可双击应用发布。

```bash
cd desktop
pnpm run build:app        # 构建 TS + 构建前端 + 校验资源 + electron-builder
```

`desktop/electron-builder.yml` 会打包：

- `dist/**` —— 编译后的 Electron main / preload
- `../frontend/out` —— Next.js 静态导出（通过 `next export`）
- `../qiongqi` —— 完整运行时（剔除缓存）
- `../skills` —— 共享技能库
- `build/icons` —— 各平台图标（macOS `.icns`、Windows `.ico`、Linux `.png`）

产物输出到 `desktop/release/`。支持的目标：`dmg` / `zip`（macOS）、`nsis` / `portable`（Windows）、`AppImage` / `deb`（Linux）。

---

## 🧪 开发检查

提交前请运行以下检查。各工作区有独立的工具链：

```bash
# 前端
cd frontend && pnpm lint && pnpm typecheck && pnpm test

# QiongQi 运行时
cd qiongqi && pnpm run typecheck && pnpm test:fast

# 桌面端
cd desktop && pnpm run lint && node --test tests/*.test.mjs && pnpm run build:app
```

若要运行 QiongQi 完整验证套件（包含原生 SQLite 绑定与事件化 A2A 链路）：

```bash
cd qiongqi
pnpm run prepare:sqlite
pnpm run verify:sqlite
pnpm run verify:evented-a2a
```

---

## 🗺️ 延伸阅读

| 你想做的事                                  | 请阅读                                                            |
| ------------------------------------------- | ----------------------------------------------------------------- |
| 理解多 Agent 引擎设计                        | [`qiongqi/docs/architecture.zh.md`](./qiongqi/docs/architecture.zh.md) |
| 阅读 QiongQi 逐包技术文档                   | [`qiongqi/docs/packages/`](./qiongqi/docs/packages/)              |
| 在生产环境部署 QiongQi                       | [`qiongqi/docs/deployment.zh.md`](./qiongqi/docs/deployment.zh.md) |
| 构建自定义技能                               | [`skills/public/skill-creator/`](./skills/public/skill-creator/)  |
| 向仓库贡献代码                               | [`CONTRIBUTING.zh.md`](./CONTRIBUTING.zh.md)                      |
| 查看前端站点地图与组件                       | [`frontend/README.md`](./frontend/README.md)                     |
| 打包桌面应用                                 | [`desktop/README.md`](./desktop/README.md)                       |

---

## 📄 许可证

KWorks 以 [MIT 许可证](./LICENSE) 发布。贡献代码即表示你同意你的贡献将按相同条款授权。
