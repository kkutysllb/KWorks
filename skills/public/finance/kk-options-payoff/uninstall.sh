#!/bin/sh
# Uninstall script for kk-options-payoff
set -e

echo "→ Uninstalling kk-options-payoff..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  kk-options-payoff uninstalled successfully."
