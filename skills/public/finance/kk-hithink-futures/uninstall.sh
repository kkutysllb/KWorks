#!/bin/sh
# Uninstall script for kk-hithink-futures
set -e

echo "→ Uninstalling kk-hithink-futures..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-hithink-futures uninstalled successfully."
