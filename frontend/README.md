# KWorks Frontend

**中文**: [README.zh.md](./README.zh.md)

The web UI for KWorks — a modern, streaming-first interface built on Next.js 16 and React 19 that talks to the [QiongQi runtime](../qiongqi/) over HTTP and Server-Sent Events.

## Tech Stack

| Layer            | Choice                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Framework        | [Next.js 16](https://nextjs.org/) with [App Router](https://nextjs.org/docs/app) + Turbopack |
| UI library       | [React 19](https://react.dev/)                                                               |
| Styling          | [Tailwind CSS 4](https://tailwindcss.com/) + [tw-animate-css](https://github.com/romboHQ/tw-animate-css) |
| Component system | [Shadcn UI](https://ui.shadcn.com/), [MagicUI](https://magicui.design/), [React Bits](https://reactbits.dev/) + [Radix primitives](https://www.radix-ui.com/) |
| Icons            | [lucide-react](https://lucide.dev/)                                                          |
| State / data     | [TanStack Query 5](https://tanstack.com/query/latest)                                        |
| AI primitives    | [Vercel AI SDK](https://sdk.vercel.ai/) + [@langchain/core](https://js.langchain.com/)       |
| Streaming markdown | [streamdown](https://github.com/nichenqin/streamdown) + [Shiki](https://shiki.style/) + [KaTeX](https://katex.org/) + [rehype/remark](https://github.com/remarkjs) ecosystem |
| Code editor      | [CodeMirror 6](https://codemirror.net/) (`@uiw/react-codemirror` + language packs + themes)  |
| Terminal         | [xterm.js](https://xtermjs.org/) (`@xterm/xterm` + `@xterm/addon-fit`)                       |
| Flow canvas      | [xyflow](https://xyflow.com/) (`@xyflow/react`)                                              |
| Charts           | [Recharts](https://recharts.org/)                                                            |
| Animation        | [GSAP](https://gsap.com/) + [Motion](https://motion.dev/)                                    |
| Docs site        | [Nextra 4](https://nextra.site/) (`nextra-theme-docs`) — disabled in desktop static exports  |
| Env validation   | [@t3-oss/env-nextjs](https://env.t3.gg/) + [Zod](https://zod.dev/)                           |
| Unit tests       | [Vitest 4](https://vitest.dev/) with [happy-dom](https://github.com/capricorn86/happy-dom)   |
| E2E tests        | [Playwright](https://playwright.dev/)                                                        |
| Lint / format    | [ESLint 9](https://eslint.org/) + [Prettier 3](https://prettier.io/) + [typescript-eslint](https://typescript-eslint.io/) |

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10.26.2+
- A running QiongQi gateway (see the [root README](../README.md) for the full local stack)

### Install

```bash
pnpm install
```

The dev server reads its gateway target from `NEXT_PUBLIC_BACKEND_BASE_URL`. When unset, `next.config.js` rewrites `/api/*`, `/v1/*`, and `/health` to `http://127.0.0.1:9193` (overridable via `KWorks_INTERNAL_GATEWAY_BASE_URL`). This means you can usually just start the gateway with `./start.sh start` from the repo root and run the frontend separately.

### Development

```bash
pnpm dev            # http://localhost:9192 (Turbopack)
pnpm dev:fresh      # wipe .next/ and restart
```

### Build & Test

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm lint:fix       # eslint --fix
pnpm format         # prettier --check .
pnpm format:write   # prettier --write .
pnpm test           # vitest run (unit)
pnpm test:e2e       # playwright test (E2E against Chromium)
pnpm build          # next build (web)
pnpm build:desktop  # next build with DESKTOP_BUILD=true → static export to ../frontend/out
pnpm start          # next start (production server)
pnpm preview        # next build && next start
```

## Sitemap

```
/                         # Landing / sign-in
/(auth)/*                 # Authentication routes
/workspace                # Authenticated workspace shell
/workspace/chats          # Conversation list
/workspace/chats/new      # Start a new conversation
/workspace/chats/[id]     # A specific conversation (streaming + tools + artifacts)
```

The workspace also hosts skill galleries, MCP browser, settings, and artifact viewers — discoverable once authenticated.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Authentication route group
│   ├── workspace/          # Authenticated workspace pages
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── global-error.tsx    # Global error boundary
├── components/             # React components
│   ├── ui/                 # Reusable Shadcn-style primitives
│   ├── workspace/          # Workspace-specific panels (chat, artifacts, tools)
│   ├── landing/            # Landing-page hero + sections
│   ├── ai-elements/        # AI streaming UI blocks (message, tool-call, reasoning)
│   └── desktop/            # Desktop-only integration components
├── core/                   # Framework-agnostic business logic
│   ├── api/                # Typed API client + fetch helpers
│   ├── threads/            # Thread lifecycle, SSE replay, submission
│   ├── messages/           # Message rendering pipeline
│   ├── models/             # Shared types and Zod schemas
│   ├── skills/             # Skill catalog + activation
│   ├── mcp/                # MCP server browser
│   ├── memory/             # Cross-session memory panel
│   ├── artifacts/          # Artifact viewer state
│   ├── tasks/              # Background task tracking
│   ├── todos/              # Todo list integration
│   ├── agents/             # Agent identity / presets
│   ├── auth/               # Session and token handling
│   ├── settings/           # User settings store
│   ├── settings-config/    # Settings schema and defaults
│   ├── i18n/               # Internationalization (en / zh)
│   ├── rehype/             # Custom rehype plugins for markdown
│   ├── streamdown/         # Streaming markdown renderer config
│   ├── uploads/            # Attachment uploads
│   ├── notifications/      # Toast / in-app notifications
│   ├── channels/           # Event channel multiplexing
│   ├── crons/              # Scheduled job descriptors
│   ├── projects/           # Project / workspace metadata
│   ├── tools/              # Tool diagnostics + invocation
│   ├── desktop/            # Electron bridge (IPC contract)
│   ├── workspace-runtime/  # Workspace-local runtime config
│   ├── config/             # App-wide configuration constants
│   └── utils/              # Pure utility helpers
├── hooks/                  # Cross-cutting React hooks
│   ├── use-mobile.ts       # Responsive breakpoint detection
│   └── use-global-shortcuts.ts
├── lib/                    # Low-level utilities
│   ├── utils.ts            # cn() and small helpers
│   └── ime.ts              # Input-method-editor helpers
├── styles/                 # Global CSS
├── content/                # Static markdown / MDX content
├── typings/                # Ambient type declarations
├── env.js                  # @t3-oss/env-nextjs schema
└── mdx-components.tsx      # MDX component mapping
```

## Environment Variables

Validated at build time via `src/env.js`. Mark client-exposed variables with the `NEXT_PUBLIC_` prefix.

| Variable                              | Scope   | Purpose                                                          |
| ------------------------------------- | ------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_BACKEND_BASE_URL`        | client  | Absolute gateway URL. When set, disables the built-in rewrites.  |
| `NEXT_PUBLIC_RUNTIME_API_BASE_URL`    | client  | Optional separate base for the `/api/*` runtime surface.         |
| `NEXT_PUBLIC_STATIC_WEBSITE_ONLY`     | client  | Opt-out flag for static-only deployments.                        |
| `KWorks_INTERNAL_GATEWAY_BASE_URL`    | server  | Override the rewrite target (defaults to `http://127.0.0.1:9193`) |
| `INTERNAL_GATEWAY_URL`                | server  | Alias used by the root `serve.mjs` orchestrator.                 |
| `GITHUB_OAUTH_TOKEN`                  | server  | Optional GitHub OAuth token.                                     |
| `SKIP_ENV_VALIDATION`                 | build   | Skip Zod validation (useful for Docker builds).                  |
| `DESKTOP_BUILD`                       | build   | `true` / `1` switches to `output: "export"` and disables Nextra. |

## Desktop Static Export

`pnpm build:desktop` (invoked by the desktop `build:app` pipeline) sets `DESKTOP_BUILD=true`, which:

- Switches Next.js to [`output: "export"`](https://nextjs.org/docs/app/building-your-application/deploying/static-exports), producing `out/`
- Disables `i18n` and `rewrites` (both incompatible with static export)
- Skips the Nextra wrapper (the docs site is web-only)
- Marks images as unoptimized (Electron serves them via `app://`)

The resulting `out/` directory is then bundled by `electron-builder` — see [`desktop/README.md`](../desktop/README.md).

## Interaction Ownership

These ownership rules keep streaming state predictable:

- **Composer busy-state** lives in `src/app/workspace/chats/[thread_id]/page.tsx`.
- **Pre-submit upload state + thread submission** lives in `src/core/threads/hooks.ts`.
- **`usePoseStream`** is a passive store selector; the global WebSocket lifecycle stays in the root layout.

When adding a new streaming surface, prefer reusing the `core/threads` pipeline rather than spawning a parallel SSE subscription.

## Testing

```bash
pnpm test           # Vitest unit tests (tests/unit/, mirrors src/ layout)
pnpm test:e2e       # Playwright E2E (tests/e2e/, Chromium, mocked backend)
```

Unit tests live under `tests/unit/` and mirror the `src/` directory layout. E2E tests under `tests/e2e/` drive Chromium against a mocked backend to keep them deterministic.

## Contributing

When adding new agent features:

1. Follow the established directory layout (`core/<domain>/` for logic, `components/<area>/` for UI).
2. Add comprehensive TypeScript types and Zod schemas where data crosses a boundary.
3. Implement proper error handling for streaming paths.
4. Add unit tests under `tests/unit/` and E2E coverage under `tests/e2e/` where it adds signal.
5. Run `pnpm lint && pnpm typecheck && pnpm test` before pushing.

See [`AGENTS.md`](./AGENTS.md) for the agent-architecture deep dive and the root [`CONTRIBUTING.md`](../CONTRIBUTING.md) for repo-wide conventions.

## License

MIT — see [LICENSE](../LICENSE).
# KWorks 前端

为 KWorks 提供一个简洁易用的网页界面，采用现代化灵活的架构。

## 技术栈

- **框架**: [Next.js 16](https://nextjs.org/) with [App Router](https://nextjs.org/docs/app)
- **UI**: [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/), [MagicUI](https://magicui.design/) and [React Bits](https://reactbits.dev/)
- **AI 集成**: [qiongqi 原生引擎](../qiongqi/) `/v1/` API + RuntimeEvent SSE and [Vercel AI Elements](https://vercel.com/ai-sdk/ai-elements)

## 快速开始

### 前置条件

- Node.js 22+
- pnpm 10.26.2+

### 安装

```bash
pnpm install
cp .env.example .env
```

### 开发

```bash
pnpm dev        # http://localhost:9192
```

### 构建与测试

```bash
pnpm typecheck  # 类型检查
pnpm lint       # Lint
pnpm test       # 单元测试
pnpm test:e2e   # E2E 测试
pnpm build      # 生产构建
pnpm start      # 生产服务器
```

## 站点地图

```
├── /                    # 登录页
├── /chats               # 对话列表
├── /chats/new           # 新对话页
└── /chats/[thread_id]   # 特定对话页
```

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
├── components/             # React 组件
│   ├── ui/                 # 可复用 UI 组件
│   ├── workspace/          # 工作区特定组件
│   ├── landing/            # 登录页组件
│   └── ai-elements/        # AI 相关 UI 元素
├── core/                   # 核心业务逻辑
│   ├── api/                # API 客户端与数据获取
│   ├── threads/            # 线程管理
│   ├── skills/             # 技能系统
│   ├── mcp/                # MCP 集成
│   ├── messages/           # 消息处理
│   ├── models/             # 数据模型与类型
│   └── settings/           # 用户设置
├── hooks/                  # 自定义 React hooks
├── lib/                    # 共享库与工具
└── styles/                 # 全局样式
```

## 许可证

MIT License. 详见 [LICENSE](../LICENSE).
