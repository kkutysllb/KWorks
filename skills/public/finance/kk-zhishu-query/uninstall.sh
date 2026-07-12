#!/bin/sh
# Uninstall script for kk-zhishu-query
set -e

echo "→ Uninstalling kk-zhishu-query..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-zhishu-query uninstalled successfully."
