# Contributing to KWorks

**中文**: [CONTRIBUTING.zh.md](./CONTRIBUTING.zh.md)

Thanks for your interest in KWorks. This document is for contributors who plan to modify, debug, or review code in this repository. The content reflects the current repository structure.

## Project Layout

KWorks consists of three main workspaces:

```text
KWorks/
├── frontend/   # Next.js + React web frontend
├── qiongqi/    # QiongQi TypeScript runtime, API gateway, and Agent engine
├── desktop/    # Electron desktop shell
├── scripts/    # Root-level service orchestration scripts
├── skills/     # Agent skills shipped with the repository
└── start.sh    # Local Node stack entry point
```

Note: `qiongqi/` is the only valid location for QiongQi source code. References to `third_party/qiongqi` in older docs or legacy scripts are migration leftovers and must not be used for new development.

## Development Environment

Recommended toolchain:

- Node.js 22+
- pnpm 10+

This repository does not use a root-level pnpm workspace, nor does it rely on nginx as a local development entry point. Install dependencies in each workspace you need to modify:

```bash
cd qiongqi && pnpm install
cd ../frontend && pnpm install
cd ../desktop && pnpm install
```

## Local Startup

The full local stack is launched by the root-level `start.sh`. Build QiongQi first before the initial startup:

```bash
cd qiongqi
pnpm run build
cd ..
./start.sh start
```

Default service addresses:

| Service | Default Address | Description |
| --- | --- | --- |
| Frontend | `http://127.0.0.1:9192` | Next.js web frontend |
| Gateway | `http://127.0.0.1:9193` | QiongQi HTTP/SSE API |

Common service commands:

```bash
./start.sh status
./start.sh logs
./start.sh restart
./start.sh stop
```

`start.sh` delegates to `scripts/serve.mjs` to start the gateway and frontend. Model-related configuration is read from environment variables first, such as `QIONGQI_API_KEY`, `QIONGQI_BASE_URL`, and `QIONGQI_MODEL`; some `DEEPSEEK_*` variables are also supported for backward compatibility.

## Per-Workspace Development

### Frontend

```bash
cd frontend
pnpm dev        # Local development
pnpm lint       # ESLint
pnpm typecheck  # TypeScript
pnpm test       # Vitest unit tests
pnpm test:e2e   # Playwright E2E
pnpm build      # Next.js build
```

### QiongQi

```bash
cd qiongqi
pnpm run build
pnpm run typecheck
pnpm test
pnpm run test:fast
```

To verify the hybrid SQLite storage path:

```bash
cd qiongqi
pnpm run prepare:sqlite
pnpm run verify:sqlite
```

To verify the evented orchestrator and A2A dual-instance pipeline:

```bash
cd qiongqi
pnpm run verify:evented-a2a
```

### Desktop

```bash
cd desktop
pnpm run dev
pnpm run lint
node --test tests/*.test.mjs
pnpm run build:app
```

Desktop packaging depends on the `frontend/` desktop build artifact, the root `qiongqi/` runtime, `skills/`, and the desktop icon assets.

## Recommended Workflow

1. Create a feature branch from the latest main branch:

   ```bash
   git checkout -b feature/your-feature
   ```

2. Read the tests and call sites near the module you plan to modify to keep the change scope contained.

3. Run checks based on the affected scope:

   ```bash
   cd frontend && pnpm lint && pnpm typecheck && pnpm test
   cd qiongqi && pnpm run typecheck && pnpm test
   cd desktop && pnpm run lint && node --test tests/*.test.mjs
   ```

4. Before committing, confirm there are no unrelated changes:

   ```bash
   git status --short
   git diff --check
   ```

5. Use a clear commit message describing the behavior change, test results, and migration impact.

## Code and Configuration Conventions

- Never commit real API keys, tokens, user data directories, or local `.env` contents to the repository.
- New QiongQi engine code should live under the corresponding package in `qiongqi/`; do not reintroduce `third_party/qiongqi`.
- Frontend user-facing configuration should only expose options users need to understand and control; engine-internal capabilities should keep their default behavior in the runtime layer.
- When dealing with user data, memory, threads, tasks, or workspace isolation, always check the owner/user/thread/workspace scope to avoid cross-user or cross-task leakage.
- Ports, commands, and paths in documentation should reference the current scripts or `package.json`; avoid hardcoding easily-stale statistics such as test counts.

## Documentation Index

- [README.md](./README.md) - Repository overview and quick start
- [frontend/README.md](./frontend/README.md) - Frontend development guide
- [qiongqi/README.zh.md](./qiongqi/README.zh.md) - QiongQi engine guide

## License

By contributing to KWorks, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
