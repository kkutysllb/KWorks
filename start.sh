#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(builtin cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
cd "$SCRIPT_DIR"

COMMAND="${1:-start}"
MODE="${2:-dev}"

case "$COMMAND" in
  start)
    node scripts/serve.mjs start "$MODE"
    ;;
  stop)
    node scripts/serve.mjs stop
    ;;
  restart)
    node scripts/serve.mjs stop
    node scripts/serve.mjs start "$MODE"
    ;;
  status)
    node scripts/serve.mjs status
    ;;
  logs)
    tail -f logs/gateway.log logs/frontend.log
    ;;
  help|--help|-h)
    node scripts/serve.mjs help
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    node scripts/serve.mjs help
    exit 1
    ;;
esac
