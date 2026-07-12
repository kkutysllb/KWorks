#!/bin/sh
# Uninstall script for kk-business-query
set -e

echo "→ Uninstalling kk-business-query..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-business-query uninstalled successfully."
