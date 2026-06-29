#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(builtin cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
cd "$SCRIPT_DIR"

COMMAND="${1:-start}"
MODE="${2:-dev}"

case "$COMMAND" in
  start)
    node --env-file=.env scripts/serve.mjs start "$MODE"
    ;;
  stop)
    node --env-file=.env scripts/serve.mjs stop
    ;;
  restart)
    node --env-file=.env scripts/serve.mjs stop
    node --env-file=.env scripts/serve.mjs start "$MODE"
    ;;
  status)
    node --env-file=.env scripts/serve.mjs status
    ;;
  logs)
    tail -f logs/gateway.log logs/frontend.log
    ;;
  help|--help|-h)
    node --env-file=.env scripts/serve.mjs help
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    node scripts/serve.mjs help
    exit 1
    ;;
esac
