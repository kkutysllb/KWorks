#!/bin/sh
# Uninstall script for kk-news-search
set -e

echo "→ Uninstalling kk-news-search..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-news-search uninstalled successfully."
