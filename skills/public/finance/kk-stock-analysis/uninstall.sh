#!/bin/sh
# Uninstall script for kk-stock-analysis
set -e

echo "→ Uninstalling kk-stock-analysis..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-stock-analysis uninstalled successfully."
