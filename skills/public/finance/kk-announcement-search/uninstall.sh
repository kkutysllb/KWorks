#!/bin/sh
# Uninstall script for kk-announcement-search
set -e

echo "→ Uninstalling kk-announcement-search..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-announcement-search uninstalled successfully."
