#!/usr/bin/env node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const DESKTOP_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(DESKTOP_DIR, "..");
const QIONGQI_DIR = join(REPO_ROOT, "qiongqi");
const BUILD_DIR = join(DESKTOP_DIR, "build");
const RUNTIME_ARCHIVE = join(BUILD_DIR, "qiongqi-runtime.tar.gz");
const PACKAGE_DIST_INDEXES = [
  "packages/foundation/contracts/dist/index.js",
  "packages/infrastructure/adapter-fs/dist/index.js",
  "packages/domain-layer/domain/dist/index.js",
  "packages/infrastructure/attachments/dist/index.js",
  "packages/infrastructure/tool-infra/dist/index.js",
  "packages/ports-layer/ports/dist/index.js",
  "packages/infrastructure/cache/dist/index.js",
  "packages/adapters/adapter-model/dist/index.js",
  "packages/adapters/adapter-storage/dist/index.js",
  "packages/capabilities/memory/dist/index.js",
  "packages/capabilities/skills/dist/index.js",
  "packages/engine/services/dist/index.js",
  "packages/delegation-layer/delegation/dist/index.js",
  "packages/adapters/adapter-tools/dist/index.js",
  "packages/engine/loop/dist/index.js",
  "packages/http-layer/http/dist/index.js",
  "packages/presets/preset-coding/dist/index.js",
  "packages/cli-layer/cli/dist/index.js",
];

function requirePath(path, label) {
  if (!existsSync(path)) {
    console.error(`[FAIL] ${label}: ${path}`);
    process.exit(1);
  }
}

requirePath(
  join(QIONGQI_DIR, "packages", "cli-layer", "cli", "dist", "serve-entry.js"),
  "QiongQi built serve entry",
);
requirePath(join(QIONGQI_DIR, "node_modules"), "QiongQi node_modules");

const buildResult = spawnSync(process.execPath, [join(QIONGQI_DIR, "scripts", "build.mjs")], {
  cwd: QIONGQI_DIR,
  stdio: "inherit",
});
if (buildResult.status !== 0) {
  console.error("[FAIL] QiongQi build failed; refusing to archive incomplete runtime");
  process.exit(buildResult.status ?? 1);
}

for (const relativePath of PACKAGE_DIST_INDEXES) {
  requirePath(join(QIONGQI_DIR, relativePath), `QiongQi package dist ${relativePath}`);
}

mkdirSync(BUILD_DIR, { recursive: true });
rmSync(RUNTIME_ARCHIVE, { force: true });

const result = spawnSync(
  "tar",
  [
    "--exclude=.DS_Store",
    "--exclude=.git",
    "--exclude=.turbo",
    "--exclude=.vite",
    "--exclude=.vite-temp",
    "--exclude=node_modules/.cache",
    "--exclude=deploy",
    "--exclude=docs",
    "--exclude=default",
    "--exclude=outputs",
    "--exclude=tests",
    "--exclude=findings.md",
    "--exclude=progress.md",
    "--exclude=task_plan.md",
    "-czf",
    RUNTIME_ARCHIVE,
    "-C",
    REPO_ROOT,
    "qiongqi",
  ],
  {
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  console.error(`[FAIL] Failed to create ${RUNTIME_ARCHIVE}`);
  process.exit(result.status ?? 1);
}

console.log(`[OK] Created ${RUNTIME_ARCHIVE}`);
