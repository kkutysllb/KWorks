#!/bin/sh
# Uninstall script for kk-cb-analysis
set -e

echo "→ Uninstalling kk-cb-analysis..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-cb-analysis uninstalled successfully."
