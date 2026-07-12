#!/bin/sh
# Uninstall script for kk-report-search
set -e

echo "→ Uninstalling kk-report-search..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-report-search uninstalled successfully."
