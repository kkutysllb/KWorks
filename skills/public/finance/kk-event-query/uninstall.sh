#!/bin/sh
# Uninstall script for kk-event-query
set -e

echo "→ Uninstalling kk-event-query..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-event-query uninstalled successfully."
