#!/bin/sh
# Uninstall script for kk-options-volatility
set -e

echo "→ Uninstalling kk-options-volatility..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-options-volatility uninstalled successfully."
