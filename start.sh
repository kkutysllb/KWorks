#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(builtin cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
cd "$SCRIPT_DIR"

COMMAND="${1:-dev}"

case "$COMMAND" in
  start|dev)
    exec pnpm -C desktop run dev
    ;;
  build|package|build:app)
    exec pnpm -C desktop run build:app
    ;;
  help|--help|-h)
    cat <<'EOF'
KWorks is Electron-only.

Use:
  ./start.sh dev       Start the Electron desktop app in development
  ./start.sh build     Package the Electron desktop app
  cd desktop && pnpm run dev
  cd desktop && pnpm run build:app
EOF
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    "$0" help
    exit 1
    ;;
esac
