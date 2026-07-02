#!/usr/bin/env node

import { existsSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, "..");
const source = join(desktopDir, "dist", "preload.js");
const target = join(desktopDir, "dist", "preload.cjs");

if (!existsSync(source)) {
  console.error(`[rename-preload] missing compiled preload: ${source}`);
  process.exit(1);
}

rmSync(target, { force: true });
renameSync(source, target);
console.log("[rename-preload] dist/preload.js -> dist/preload.cjs");
