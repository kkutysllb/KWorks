#!/bin/sh
# Uninstall script for kk-macro-query
set -e

echo "→ Uninstalling kk-macro-query..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-macro-query uninstalled successfully."
