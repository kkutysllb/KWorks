#!/bin/sh
# Uninstall script for kk-etf-analysis
set -e

echo "→ Uninstalling kk-etf-analysis..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-etf-analysis uninstalled successfully."
