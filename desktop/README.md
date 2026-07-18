# KWorks Desktop

**中文**: [README.zh.md](./README.zh.md)

The Electron shell that wraps the KWorks frontend and bundles the QiongQi runtime into a single, self-contained desktop application for macOS, Windows, and Linux.

> The desktop app is **fully self-contained**: it ships its own copy of the QiongQi runtime, the shared skill library, and the static frontend export. Once installed, it runs without a separate Node toolchain or a running web server.

## Highlights

- **Single double-clickable app** — bundles runtime + skills + frontend, no external dependencies at runtime.
- **Isolated data directory** — uses `~/.kworks-workspace/` for all desktop state.
- **Bundled backend lifecycle** — spawns and supervises the QiongQi gateway as a child process, polls `/health`, and shuts it down cleanly on exit.
- **Custom `app://` scheme** — serves the static frontend export with `secure: true`, `corsEnabled: true`, `supportFetchAPI: true`, so browser-grade APIs work inside Electron.
- **System tray + global shortcut** — `CmdOrCtrl+Shift+O` toggles the window; closing the window hides to tray instead of quitting.
- **Single-instance lock** — a second launch focuses the existing window instead of starting a duplicate.
- **Auto-update** — `electron-updater` checks for releases and applies them on next launch.
- **Native terminal** — `node-pty` powers the in-app terminal pane (permissions are fixed automatically via `postinstall`).
- **URL security policy** — only allow-listed external URLs may open in the system browser; all navigation is sandboxed.
- **Multi-window** — each workspace opens in its own `BrowserWindow` with shared session state.

## Tech Stack

| Concern             | Choice                                                |
| ------------------- | ----------------------------------------------------- |
| Shell               | [Electron 33](https://www.electronjs.org/)            |
| Language            | TypeScript 5 (ESM, `ES2022` target)                   |
| Bundler / packager  | [electron-builder 25](https://www.electronjs.org/docs/latest/tutorial/electron-builder) |
| Auto-update         | [electron-updater 6](https://github.com/electron-userland/electron-builder/tree/master/packages/electron-updater) |
| Native terminal     | [node-pty 1.1](https://github.com/microsoft/node-pty)  |
| Test runner         | Node's built-in [`node --test`](https://nodejs.org/api/test.html) |
| Module format       | ESM (`"type": "module"`), preload compiled to `.cjs`  |

## Repository Layout

```
desktop/
├── src/
│   ├── main.ts                  # Electron main process entry (window, tray, menu, shortcut)
│   ├── backend.ts               # QiongQi gateway child-process lifecycle
│   ├── qiongqi-launch-config.ts # Resolve model / baseUrl / apiKey / storage from env or user config
│   ├── frontend-protocol.ts     # Resolve app:// static-export request paths
│   ├── ipc.ts                   # IPC channel registration (main ↔ renderer)
│   ├── preload.ts               # Context-isolated preload (compiled to dist/preload.cjs)
│   ├── paths.ts                 # Path resolution for bundled runtime, skills, logs, data dirs
│   ├── migration.ts             # One-time data / skill migration on first launch
│   ├── updater.ts               # electron-updater wiring
│   ├── shutdown.ts              # Graceful backend shutdown with timeout
│   ├── logger.ts                # Shared logger + renderer log relay
│   └── url-policy.ts            # Allowed-origin / external-URL policy
├── scripts/
│   ├── dev.mjs                  # Dev launcher (builds TS, starts gateway + Next dev + Electron)
│   ├── generate-icons.sh        # Generate platform icons from a source PNG
│   ├── fix-node-pty-permissions.mjs  # postinstall: fix native binary perms
│   └── verify-package-resources.mjs  # Pre-pack assertion that resources exist
├── tests/                       # 18 node:test suites (lifecycle, security, packaging...)
├── electron-builder.yml         # Packaging config (files, extraResources, targets)
├── tsconfig.json                # Main-process TS config
├── tsconfig.preload.json        # Preload TS config (CommonJS output)
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- The repo-root frontend and qiongqi workspaces must already be installed and built (see below)
- Platform toolchain for native modules (`node-pty` requires a C++ compiler)

### Install

```bash
cd desktop
pnpm install        # postinstall auto-runs fix-node-pty-permissions.mjs
```

### Development mode

```bash
pnpm run dev
```

`scripts/dev.mjs` will:

1. Compile `src/*.ts` → `dist/` (and `preload.ts` → `dist/preload.cjs`)
2. Start the QiongQi gateway from the repo-root `qiongqi/` runtime
3. Start the repo-root `frontend/` Next dev server on `127.0.0.1:18659`
4. Start Electron with the preload bridge enabled and open the KWorks window

### Packaging a release

```bash
pnpm run build:app
```

This runs the full pipeline:

1. `pnpm run build` — compile main + preload TypeScript
2. `pnpm run build:frontend` — invoke `frontend/` with `DESKTOP_BUILD=true` to produce `frontend/out/`
3. `pnpm run verify:package-resources` — assert the runtime entry, skills, icons, and frontend export all exist
4. `electron-builder` — produce platform installers in `desktop/release/`

Output targets (per `electron-builder.yml`):

| Platform | Target(s)                  |
| -------- | -------------------------- |
| macOS    | `dmg`, `zip`               |
| Windows  | `nsis`, `portable`         |
| Linux    | `AppImage`, `deb`          |

### Useful scripts

```bash
pnpm run build               # compile TS only (main + preload)
pnpm run build:icons         # regenerate platform icons from build/icon.png
pnpm run build:frontend      # produce ../frontend/out via desktop build
pnpm run verify:package-resources  # pre-pack resource assertion
pnpm run fix:node-pty-permissions  # fix node-pty binary perms manually
pnpm run lint                # tsc --noEmit for main + preload
```

## Configuration

### Environment variables

| Variable                       | Purpose                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `KWORKS_SKIP_BACKEND_AUTOLAUNCH` | Set to `1` to skip auto-launching the bundled gateway (useful for debugging the shell). |
| `KWORKS_WORKSPACE_DIR`         | Override the workspace root (defaults to `~/.kworks-workspace`).                         |
| `QIONGQI_API_KEY` / `QIONGQI_BASE_URL` / `QIONGQI_MODEL` | Forwarded to the bundled gateway when launching.                          |

### Default ports

The desktop gateway listens on **`127.0.0.1:19987`** by default. The Electron dev renderer listens on **`127.0.0.1:18659`** and is started only by `scripts/dev.mjs`.

### Data directory

All desktop state lives under `~/.kworks-workspace/`:

```
~/.kworks-workspace/
├── users/<user-id>/         # Per-user data (threads, sessions, artifacts)
├── config.json              # Generated gateway config
├── peers.json               # A2A peer registry (if enabled)
└── logs/                    # Gateway and shell logs
```

### Electron-builder resource mapping

`electron-builder.yml` pulls these resources into the final app bundle:

| Source                | Destination    | Contents                                           |
| --------------------- | -------------- | -------------------------------------------------- |
| `dist/**`             | (app root)     | Compiled `main.js` + `preload.cjs`                 |
| `../frontend/out`     | `frontend-out` | Next.js static export                              |
| `../qiongqi`          | `qiongqi`      | Full runtime (caches excluded)                     |
| `../skills`           | `skills`       | Shared skill library                               |
| `build/icons/*`       | `icons`        | `16x16.png`, `32x32.png`                           |
| `build/icon.png`      | `icon.png`     | Linux icon                                         |
| `build/icon.icns`     | (macOS)        | macOS dock icon                                    |
| `build/icon.ico`      | (Windows)      | Windows executable icon                            |

## Security Model

- **Context isolation** is enabled; the preload runs in an isolated context and exposes a minimal IPC surface.
- **`nodeIntegration` is disabled** in the renderer.
- **URL policy** (`src/url-policy.ts`) allow-lists the `app://` origin and a small set of trusted external hosts; everything else is blocked from navigation and new-window creation.
- **Single-instance lock** prevents parallel instances from competing for the same data directory.
- **Graceful shutdown** sends `SIGTERM` to the gateway, waits up to the timeout, then escalates to `SIGKILL`.

## Testing

```bash
node --test tests/*.test.mjs
```

The 18 test suites cover backend lifecycle, single-instance behavior, multi-window management, URL policy, window security, packaging assertions, the dev launcher, and the QiongQi launch-config resolver.

## Architecture Notes

### Process model

```
┌─────────────────────────────────────────────────────────────┐
│ Electron Main (main.ts)                                     │
│  ├─ BackendManager (backend.ts)                             │
│  │    └─ spawns → node qiongqi serve (child process)       │
│  ├─ Tray + globalShortcut + Menu                            │
│  ├─ BrowserWindow(s) ← app:// frontend-out (static export)  │
│  │    └─ preload.cjs (context-isolated bridge)              │
│  └─ Updater (electron-updater)                              │
└─────────────────────────────────────────────────────────────┘
        │ IPC (ipc.ts)                │ HTTP / SSE on 127.0.0.1:19987
        ▼                             ▼
┌──────────────────┐          ┌────────────────────────────────┐
│ Renderer process │ ◀──────  │ QiongQi runtime (bundled)       │
│ (Next.js static) │           │ /v1/* + /a2a/* + /health        │
└──────────────────┘          └─────────────────────────────────┘
```

### Dev vs. packaged resolution

The main process decides where the renderer loads from:

- **Dev** — `scripts/dev.mjs` starts Next on `http://127.0.0.1:18659`, then Electron loads that URL for hot reload.
- **Packaged** — register the `app://` scheme and load `app://-/index.html` from the bundled `frontend-out/`.

Similarly, `backend.ts` resolves the runtime:

- **Dev** — use the repo-root `qiongqi/packages/cli-layer/cli/dist/serve-entry.js` (the just-built dev runtime).
- **Packaged** — use the bundled `qiongqi/` copy inside `resources/`.

## Troubleshooting

- **`node-pty` install fails** — ensure a C++ toolchain is installed (Xcode CLT on macOS). Re-run `pnpm run fix:node-pty-permissions` after install.
- **Window opens blank** — check `logs/` for backend startup errors; verify the gateway became healthy before the renderer loaded.
- **Port conflict on 19987** — another desktop instance may be running. The single-instance lock should prevent this, but a crashed process can leave the port occupied; kill it manually.
- **Auto-update not triggering** — `electron-updater` requires a published release feed; in dev builds it no-ops.

## License

MIT — see [LICENSE](../LICENSE).
