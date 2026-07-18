#!/usr/bin/env node

const command = process.argv[2] ?? "start";

if (command === "help" || command === "--help" || command === "-h") {
  console.log(`KWorks is Electron-only.

Use:
  pnpm -C desktop dev        Start the Electron desktop app in development
  pnpm -C desktop build:app  Package the Electron desktop app

The legacy Node + standalone Next.js web stack has been removed.`);
  process.exit(0);
}

console.error(
  `[root] scripts/serve.mjs ${command} is disabled because KWorks is Electron-only.\n` +
    "Use `pnpm -C desktop dev` for development or " +
    "`pnpm -C desktop build:app` for packaging.",
);
process.exit(1);
