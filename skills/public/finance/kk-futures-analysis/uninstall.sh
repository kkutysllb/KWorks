#!/bin/sh
# Uninstall script for kk-futures-analysis
set -e

echo "→ Uninstalling kk-futures-analysis..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-futures-analysis uninstalled successfully."
