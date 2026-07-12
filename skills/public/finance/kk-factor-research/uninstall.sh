#!/bin/sh
# Uninstall script for kk-factor-research
set -e

echo "→ Uninstalling kk-factor-research..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-factor-research uninstalled successfully."
