# KWorks Electron Renderer

**中文**: [README.zh.md](./README.zh.md)

The Electron renderer for KWorks — a Next.js 16 + React 19 UI that is launched only through the [`desktop/`](../desktop/) Electron shell. It talks directly to the Electron-managed [QiongQi runtime](../qiongqi/) over HTTP and Server-Sent Events.

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
| Env validation   | [@t3-oss/env-nextjs](https://env.t3.gg/) + [Zod](https://zod.dev/)                           |
| Unit tests       | [Vitest 4](https://vitest.dev/) with [happy-dom](https://github.com/capricorn86/happy-dom)   |
| Lint / format    | [ESLint 9](https://eslint.org/) + [Prettier 3](https://prettier.io/) + [typescript-eslint](https://typescript-eslint.io/) |

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10.26.2+
- The desktop app dependencies installed in [`../desktop`](../desktop/)

### Install

```bash
pnpm install
```

This package is not a standalone web app. `pnpm dev`, `pnpm start`, `pnpm preview`, and `pnpm build` intentionally fail with a desktop-only message. Use the desktop package as the only runtime entrypoint.

### Development

```bash
pnpm -C ../desktop dev
```

### Build & Test

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm lint:fix       # eslint --fix
pnpm format         # prettier --check .
pnpm format:write   # prettier --write .
pnpm test           # vitest run (unit)
pnpm build:desktop  # internal: static export for desktop build:app
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
├── typings/                # Ambient type declarations
└── env.js                  # @t3-oss/env-nextjs schema
```

## Environment Variables

Validated at build time via `src/env.js`. Mark client-exposed variables with the `NEXT_PUBLIC_` prefix.

| Variable                              | Scope   | Purpose                                                          |
| ------------------------------------- | ------- | ---------------------------------------------------------------- |
| `GITHUB_OAUTH_TOKEN`                  | server  | Optional GitHub OAuth token.                                     |
| `SKIP_ENV_VALIDATION`                 | build   | Skip Zod validation (useful for Docker builds).                  |
| `DESKTOP_BUILD`                       | build   | `true` / `1` switches to `output: "export"` for Electron packaging. |

## Desktop Static Export

`pnpm build:desktop` (invoked by the desktop `build:app` pipeline) sets `DESKTOP_BUILD=true`, which:

- Switches Next.js to [`output: "export"`](https://nextjs.org/docs/app/building-your-application/deploying/static-exports), producing `out/`
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
```

Unit tests live under `tests/unit/` and mirror the `src/` directory layout. Renderer integration must be exercised through the Electron desktop shell.

## Contributing

When adding new agent features:

1. Follow the established directory layout (`core/<domain>/` for logic, `components/<area>/` for UI).
2. Add comprehensive TypeScript types and Zod schemas where data crosses a boundary.
3. Implement proper error handling for streaming paths.
4. Add unit tests under `tests/unit/`; add renderer integration coverage through the desktop package where it adds signal.
5. Run `pnpm lint && pnpm typecheck && pnpm test` before pushing.

See [`AGENTS.md`](./AGENTS.md) for the agent-architecture deep dive and the root [`CONTRIBUTING.md`](../CONTRIBUTING.md) for repo-wide conventions.

## License

MIT — see [LICENSE](../LICENSE).
