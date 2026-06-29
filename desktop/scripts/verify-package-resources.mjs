#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const DESKTOP_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(DESKTOP_DIR, "..");

const FRONTEND_OUT_DIR = join(REPO_ROOT, "frontend", "out");
const QIONGQI_DIR = join(REPO_ROOT, "third_party", "qiongqi");
const SKILLS_DIR = join(REPO_ROOT, "skills");

const checks = [];

function pass(label) {
  checks.push({ label, ok: true });
}

function fail(label, detail) {
  checks.push({ label, ok: false, detail });
}

function requirePath(path, label) {
  if (!existsSync(path)) {
    fail(label, `Missing: ${path}`);
    return false;
  }
  pass(label);
  return true;
}

requirePath(join(FRONTEND_OUT_DIR, "index.html"), "frontend/out index.html");
requirePath(join(FRONTEND_OUT_DIR, "_next"), "frontend/out _next assets");
requirePath(join(SKILLS_DIR, "public"), "resources/skills public source");
requirePath(join(QIONGQI_DIR, "package.json"), "resources/qiongqi package.json source");
requirePath(
  join(QIONGQI_DIR, "packages", "cli-layer", "cli", "src", "serve-entry.ts"),
  "resources/qiongqi serve entry source",
);
requirePath(
  join(QIONGQI_DIR, "packages", "cli-layer", "cli", "dist", "serve-entry.js"),
  "resources/qiongqi built serve entry",
);
requirePath(join(QIONGQI_DIR, "node_modules"), "resources/qiongqi node_modules");

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  const prefix = check.ok ? "[OK]" : "[FAIL]";
  console.log(`${prefix} ${check.label}`);
  if (!check.ok && check.detail) console.log(`       ${check.detail}`);
}

if (failed.length > 0) {
  console.error(
    `\nPackage resource verification failed: ${failed.length} check(s) failed.`,
  );
  process.exit(1);
}

console.log("\nPackage resources are ready for electron-builder.");
