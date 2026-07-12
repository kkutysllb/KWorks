#!/bin/sh
# Uninstall script for md-to-html-converter
set -e

echo "→ Uninstalling md-to-html-converter..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  md-to-html-converter uninstalled successfully."
