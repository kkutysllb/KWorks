## Project Overview

KWorks Frontend is the Next.js 16 renderer source for the Electron desktop app. It is not a standalone web application; all runtime and integration verification must be launched through `../desktop`.

**Stack**: Next.js 16, React 19, TypeScript 5.8, Tailwind CSS 4, pnpm 10.26.2

## Commands

| Command          | Purpose                                           |
| ---------------- | ------------------------------------------------- |
| `pnpm dev`       | Disabled; use `pnpm -C ../desktop dev`            |
| `pnpm build`     | Disabled; use `pnpm -C ../desktop build:app`      |
| `pnpm check`     | Lint + type check (run before committing)         |
| `pnpm lint`      | ESLint only                                       |
| `pnpm lint:fix`  | ESLint with auto-fix                              |
| `pnpm test`      | Run unit tests with Vitest                        |
| `pnpm test:e2e`  | Disabled; renderer E2E must launch from Electron  |
| `pnpm typecheck` | TypeScript type check (`tsc --noEmit`)            |
| `pnpm start`     | Disabled; use Electron                            |

Unit tests live under `tests/unit/` and mirror the `src/` layout (e.g., `tests/unit/core/threads/qiongqi-stream.test.ts` tests `src/core/threads/qiongqi-stream.ts`). Powered by Vitest; import source modules via the `@/` path alias.

The old standalone Chromium E2E config has been removed. Add renderer integration coverage through the Electron desktop package.

## Architecture

```
Frontend (Next.js) ──▶ qiongqi `/v1/` API + SSE ──▶ qiongqi Backend (lead_agent)
                                              ├── Sub-Agents
                                              └── Tools & Skills
```

The frontend is a stateful chat application. Users create **threads** (conversations), send messages, and receive streamed AI responses. The backend orchestrates agents that can produce **artifacts** (files/code) and **todos**.

### Source Layout (`src/`)

- **`app/`** — Next.js App Router. Routes: `/` (landing), `/workspace/chats/[thread_id]` (chat).
- **`components/`** — React components split into:
  - `ui/` — Shadcn UI primitives (auto-generated, ESLint-ignored)
  - `ai-elements/` — Vercel AI SDK elements (auto-generated, ESLint-ignored)
  - `workspace/` — Chat page components (messages, artifacts, settings)
  - `landing/` — Landing page sections
- **`core/`** — Business logic, the heart of the app:
  - `threads/` — Thread creation, streaming, state management (hooks + types)
  - `api/` — REST fetch helpers (CSRF, desktop bearer token)
  - `artifacts/` — Artifact loading and caching
  - `i18n/` — Internationalization (en-US, zh-CN)
  - `settings/` — User preferences in localStorage
  - `memory/` — Persistent user memory system
  - `skills/` — Skills installation and management
  - `messages/` — Message processing and transformation
  - `mcp/` — Model Context Protocol integration
  - `models/` — TypeScript types and data models
- **`hooks/`** — Shared React hooks
- **`lib/`** — Utilities (`cn()` from clsx + tailwind-merge)
- **`server/`** — Server-side code (better-auth, not yet active)
- **`styles/`** — Global CSS with Tailwind v4 `@import` syntax and CSS variables for theming

### Data Flow

1. User input → thread hooks (`core/threads/hooks.ts`) → qiongqi SSE streaming
2. Stream events update thread state (messages, artifacts, todos)
3. TanStack Query manages server state; localStorage stores user settings
4. Components subscribe to thread state and render updates

### Key Patterns

- **Server Components by default**, `"use client"` only for interactive components
- **Thread hooks** (`useThreadStream`, `useSubmitThread`, `useThreads`) are the primary API interface
- **qiongqi client** (`qiongqiClient`) in `core/threads/qiongqi-client.ts` handles all `/v1/` REST calls; `useQiongqiStream` in `qiongqi-stream.ts` manages SSE streaming
- **Environment validation** uses `@t3-oss/env-nextjs` with Zod schemas (`src/env.js`). Skip with `SKIP_ENV_VALIDATION=1`

## Code Style

- **Imports**: Enforced ordering (builtin → external → internal → parent → sibling), alphabetized, newlines between groups. Use inline type imports: `import { type Foo }`.
- **Unused variables**: Prefix with `_`.
- **Class names**: Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- **Path alias**: `@/*` maps to `src/*`.
- **Components**: `ui/` and `ai-elements/` are generated from registries (Shadcn, MagicUI, React Bits, Vercel AI SDK) — don't manually edit these.

## Environment

Backend API URLs are resolved from the Electron preload bridge at runtime. Requires Node.js 22+ and pnpm 10.26.2+.
