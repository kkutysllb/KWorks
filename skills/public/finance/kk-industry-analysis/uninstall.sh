#!/bin/sh
# Uninstall script for kk-industry-analysis
set -e

echo "→ Uninstalling kk-industry-analysis..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-industry-analysis uninstalled successfully."
