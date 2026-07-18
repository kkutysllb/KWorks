**中文**: [README.zh.md](./README.zh.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/cover.svg">
    <img alt="KWorks — Open-Source Local-First AI Workspace" src="assets/cover.svg" width="100%" />
  </picture>
</p>

# KWorks

> **A local-first desktop AI workspace** — an open, composable super-agent platform that fuses an Electron shell, a Next.js renderer, and the domain-neutral QiongQi multi-agent runtime into a single, self-contained desktop product.

KWorks is engineered around a single thesis: **the model is the skeleton; the skills are the flesh.** The runtime stays domain-neutral so that the same engine can be a coding copilot today, a research analyst tomorrow, or a creative studio the day after — simply by swapping the skills loaded into it.

---

## ✨ Highlights

- **Local-first by design** — the full stack runs on `127.0.0.1`; no data leaves your machine unless you explicitly configure a remote model provider.
- **Electron-only product surface** — all development and runtime entrypoints go through `desktop/`; `frontend/` is the renderer source and static-export build target, not a standalone web app.
- **Cache-first agent engine** — QiongQi maximizes per-token ROI through immutable prompt prefixes, TTL/LRU caching, tool-catalog fingerprinting, and context compaction.
- **Pluggable capability matrix** — Skills, MCP servers, Web tools, Memory, and Subagent Delegation are all hot-pluggable providers behind a unified `CapabilityRegistry`.
- **Declarative loop engineering** — `LoopRunner` interprets `LoopPlan` phases (`build-prompt → run-model → decide → evaluate → dispatch-tools`) with bounded retry and rich audit events.
- **Multi-agent A2A protocol** — every runtime exposes `/.well-known/agent-card.json` and `/a2a/tasks` endpoints for cross-instance, cross-vendor agent-to-agent collaboration.
- **Production-grade observability** — Prometheus metrics, structured access logs, W3C `traceparent` propagation, and OpenTelemetry HTTP tracing ship out of the box.
- **Hybrid SQLite + JSONL storage** — Codex-style index performance with full readability, plus crash-recovery via `FileTurnStateStore`.
- **Cross-platform desktop builds** — one `electron-builder` invocation packages the frontend, runtime, skills, and icons into a signed macOS / Windows / Linux app.
- **Bilingual documentation** — every primary document ships in both English (`.md`) and Chinese (`.zh.md`).

---

## 🏗️ Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────┐
│                       Desktop (Electron shell)                   │
│          loads frontend build + bundles qiongqi runtime          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                     Frontend (Next.js 16 + React 19)             │
│   App Router · SSE streaming · CodeMirror · xterm.js · xyflow    │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTP / SSE  (/v1/* + /a2a/*)
┌──────────────────────────────▼───────────────────────────────────┐
│              QiongQi Runtime (TypeScript multi-agent engine)     │
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
                        OpenAI-compatible API
                               │
                   ┌───────────▼───────────┐
                   │  External LLM Provider │
                   │  (DeepSeek / GLM / ...)│
                   └───────────────────────┘
```

The repository itself is **not** a pnpm workspace at the root — each of `qiongqi/`, `frontend/`, and `desktop/` is an independent package with its own `pnpm-lock.yaml`. The supported product entrypoint is Electron: `desktop/` starts the renderer dev server in development and bundles the renderer static export for packaged releases.

> **Note on `third_party/`** — older branches may contain `third_party/qiongqi`. This is a migration leftover; the canonical source lives at the repository root under `qiongqi/`. Do not use `third_party/` paths for new code.

---

## 📁 Repository Layout

```text
KWorks/
├── qiongqi/            # QiongQi multi-agent runtime (18 internal packages)
├── frontend/           # Next.js 16 + React 19 Electron renderer source
├── desktop/            # Electron desktop shell
├── skills/             # Shared agent skills bundled into the desktop app
│   └── public/         # 25+ public skills (coding, research, design, media...)
├── scripts/
│   └── serve.mjs       # Disabled legacy web-stack launcher
├── start.sh            # Convenience wrapper around desktop dev/build commands
├── logs/               # Runtime logs (gateway.log, frontend.log)
├── .pids/              # Process ID files for managed services
├── assets/             # Project cover artwork
├── .env                # Local environment configuration (not committed secrets)
├── CONTRIBUTING.md     # Contributor guide (English)
├── CONTRIBUTING.zh.md  # Contributor guide (Chinese)
└── LICENSE             # MIT
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 22+** (required by the Electron renderer toolchain; the runtime supports Node 20+)
- **pnpm 10+**
- A working C++ toolchain if you plan to use the `hybrid` SQLite storage (Xcode CLT on macOS, `build-essential` on Linux, Visual Studio Build Tools on Windows)

### 1. Install dependencies in each workspace

```bash
cd qiongqi   && pnpm install
cd ../frontend && pnpm install
cd ../desktop   && pnpm install
```

### 2. Launch the desktop app in development

Run KWorks through Electron. The desktop dev launcher compiles main/preload TypeScript, prepares the QiongQi runtime, starts the local gateway, starts the Next renderer dev server, and opens the Electron window.

```bash
cd desktop
pnpm run dev
```

### 3. Package the desktop app

```bash
cd desktop
pnpm run build:app
```

`frontend/` scripts such as `pnpm dev`, `pnpm start`, and `pnpm preview` are intentionally disabled. The Next dev server is started only by `desktop/scripts/dev.mjs`, where the Electron preload bridge is available.

---

## ⚙️ Configuration

### Environment variables (`.env`)

The desktop launcher reads configuration from the environment and user data store. The key variables are:

| Variable             | Purpose                                                       | Default                       |
| -------------------- | ------------------------------------------------------------- | ----------------------------- |
| `GATEWAY_PORT`       | Port for the desktop QiongQi HTTP/SSE server                   | `19987`                       |
| `QIONGQI_API_KEY`    | API key for the upstream LLM provider                         | *(required for real models)*  |
| `QIONGQI_BASE_URL`   | Base URL of an OpenAI-compatible provider                     | `https://api.deepseek.com`    |
| `QIONGQI_MODEL`      | Default model id to bootstrap                                 | *(optional)*                  |
| `QIONGQI_DATA_DIR`   | Root data directory for threads, sessions, and artifacts      | `~/.kworks-workspace/...`     |
| `QIONGQI_STORAGE_BACKEND` | `file` (JSONL) or `hybrid` (SQLite + JSONL)             | `file`                        |
| `KWORKS_WORKSPACE_DIR` | Override the desktop workspace root                         | *(optional)* |

> **Backward compatibility**: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL` are still accepted as aliases when the `QIONGQI_*` equivalents are absent. The runtime is provider-neutral; DeepSeek is only the historical default.

The desktop workspace lives under `~/.kworks-workspace/` by default. It holds SQLite databases, user records, thread stores, session logs, bundled skills, and runtime artifacts.

### Runtime configuration file

For advanced scenarios (custom model profiles, capability toggles, observability), QiongQi accepts a JSON config file. See [`qiongqi/config.example.json`](./qiongqi/config.example.json) for the full schema, including:

- `serve.tokenEconomy` — tool description / result compression budgets
- `serve.storage.backend` — `file` vs `hybrid`
- `serve.observability.openTelemetry` — OTLP HTTP exporter settings
- `contextCompaction` — soft / hard thresholds and summary mode
- `capabilities.{mcp,web,skills,subagents,attachments,memory}` — per-capability toggles and limits

---

## 🧠 The Skill System

Skills are the "flesh" of the agent. A skill is a directory containing:

- `skill.json` — manifest (`specVersion`, `id`, `name`, `commands`, `tools.allowed`, `permissions`, optional `mcpServers`)
- `SKILL.md` — natural-language description injected into the system prompt when the skill is activated

The repository ships two skill sets:

| Location              | Count | Purpose                                                      |
| --------------------- | ----- | ------------------------------------------------------------ |
| `qiongqi/skills/`     | 11    | Engine-bundled skills (code-review, debugging, tdd, planning, goal, todo, refactoring, security-review, git-worktrees, web, review) |
| `skills/public/`      | 25+   | Product-level skills (coding, deep-research, image/video/music/podcast/ppt generation, chart-visualization, data-analysis, pdf-processing, vercel-deploy, skill-creator, ...) |

Skills are discovered via `createAgent({ skillRoots: [...] })`. The desktop packaging step copies `skills/` into the app bundle so the same skill set is available offline.

---

## 🖥️ Desktop Packaging

The Electron shell in `desktop/` wraps the frontend static export and bundles the QiongQi runtime so the whole product ships as a single double-clickable app.

```bash
cd desktop
pnpm run build:app        # build TS + build frontend + verify resources + electron-builder
```

`desktop/electron-builder.yml` packages:

- `dist/**` — compiled Electron main / preload
- `../frontend/out` — Next.js static export (via `next export`)
- `../qiongqi` — the full runtime (minus caches)
- `../skills` — the shared skill library
- `build/icons` — platform icons (macOS `.icns`, Windows `.ico`, Linux `.png`)

Output lands in `desktop/release/`. Supported targets: `dmg` / `zip` (macOS), `nsis` / `portable` (Windows), `AppImage` / `deb` (Linux).

---

## 🧪 Development Checks

Run these before pushing changes. Each workspace has its own toolchain:

```bash
# Frontend
cd frontend && pnpm lint && pnpm typecheck && pnpm test

# QiongQi runtime
cd qiongqi && pnpm run typecheck && pnpm test:fast

# Desktop
cd desktop && pnpm run lint && node --test tests/*.test.mjs && pnpm run build:app
```

For the full QiongQi verification suite (including native SQLite binding and evented A2A):

```bash
cd qiongqi
pnpm run prepare:sqlite
pnpm run verify:sqlite
pnpm run verify:evented-a2a
```

---

## 🗺️ Where to Go Next

| You want to...                                  | Read this                                                       |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Understand the multi-agent engine design        | [`qiongqi/docs/architecture.en.md`](./qiongqi/docs/architecture.en.md) |
| Read the QiongQi package-level technical docs   | [`qiongqi/docs/packages/`](./qiongqi/docs/packages/)            |
| Deploy QiongQi in production                    | [`qiongqi/docs/deployment.en.md`](./qiongqi/docs/deployment.en.md) |
| Build a custom skill                            | [`skills/public/skill-creator/`](./skills/public/skill-creator/) |
| Contribute to the repository                    | [`CONTRIBUTING.md`](./CONTRIBUTING.md)                          |
| See the frontend sitemap and components         | [`frontend/README.md`](./frontend/README.md)                   |
| Package the desktop app                         | [`desktop/README.md`](./desktop/README.md)                     |

---

## 📄 License

KWorks is released under the [MIT License](./LICENSE). By contributing, you agree that your contributions will be licensed under the same terms.
