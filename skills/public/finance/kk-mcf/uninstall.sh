#!/bin/sh
# Uninstall script for kk-mcf
set -e

echo "→ Uninstalling kk-mcf..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-mcf uninstalled successfully."
