#!/usr/bin/env node

import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

// ⚠️ 不能用 new URL(...).pathname — 在 Windows 上返回 /D:/a/... （带前导斜杠），
// path.resolve 会把它解析到当前盘符的根而非实际盘符，导致 existsSync 全部失败。
// fileURLToPath 正确处理 Windows file:///D:/... → D:\...
const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const DESKTOP_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(DESKTOP_DIR, "..");

const FRONTEND_OUT_DIR = join(REPO_ROOT, "frontend", "out");
const QIONGQI_DIR = join(REPO_ROOT, "qiongqi");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const QIONGQI_RUNTIME_ARCHIVE_RELATIVE = "build/qiongqi-runtime.tar.gz";
const QIONGQI_RUNTIME_ARCHIVE = join(DESKTOP_DIR, "build", "qiongqi-runtime.tar.gz");
const QIONGQI_RUNTIME_DIR = join(DESKTOP_DIR, "build", "qiongqi-runtime", "qiongqi");

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

function envFlag(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return undefined;
  return !/^(0|false|no|off)$/i.test(raw);
}

function requiresQiongqiRuntimeArchive() {
  return envFlag("KWORKS_REQUIRE_QIONGQI_ARCHIVE") ?? process.platform === "darwin";
}

function verifyQiongqiRuntimeArchive() {
  const result = spawnSync("tar", ["-tzf", QIONGQI_RUNTIME_ARCHIVE_RELATIVE], {
    cwd: DESKTOP_DIR,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    fail(
      "resources/qiongqi-runtime.tar.gz contents",
      result.stderr?.trim() || result.stdout?.trim() || "Unable to list archive",
    );
    return;
  }

  verifyQiongqiRuntimeListing(
    "resources/qiongqi-runtime.tar.gz",
    result.stdout ?? "",
  );
}

function verifyQiongqiRuntimeDirectory() {
  const listing = collectEntries(QIONGQI_RUNTIME_DIR, "qiongqi").join("\n");
  verifyQiongqiRuntimeListing("resources/qiongqi deployed runtime", listing);
  verifyQiongqiRuntimePackageLinks();
  verifyQiongqiRuntimeImport();
}

function verifyQiongqiRuntimeListing(label, listing) {
  if (!listing.includes("qiongqi/dist/serve-entry.js")) {
    fail(
      `${label} deployed serve entry`,
      "Missing: qiongqi/dist/serve-entry.js",
    );
  } else {
    pass(`${label} deployed serve entry`);
  }

  const rejectedNativeToolPattern =
    /@esbuild|esbuild\/bin\/esbuild|@rollup|rollup\.darwin|vitest|node-gyp/;
  const rejected = listing
    .split(/\r?\n/)
    .filter((entry) => rejectedNativeToolPattern.test(entry));
  if (rejected.length > 0) {
    fail(
      `${label} excludes dev native build tools`,
      rejected.slice(0, 10).join("\n"),
    );
  } else {
    pass(`${label} excludes dev native build tools`);
  }
}

function verifyQiongqiRuntimePackageLinks() {
  const requiredPackages = [
    "@qiongqi/http",
    "@qiongqi/contracts",
    "@qiongqi/preset-coding",
  ];
  for (const packageName of requiredPackages) {
    const path = join(QIONGQI_RUNTIME_DIR, "node_modules", ...packageName.split("/"));
    if (!existsSync(path)) {
      fail(`resources/qiongqi package ${packageName}`, `Missing: ${path}`);
      continue;
    }
    if (lstatSync(path).isSymbolicLink()) {
      fail(
        `resources/qiongqi package ${packageName} is materialized`,
        `Unexpected symlink: ${path}`,
      );
    } else {
      pass(`resources/qiongqi package ${packageName} is materialized`);
    }
  }
}

function verifyQiongqiRuntimeImport() {
  const entry = join(QIONGQI_RUNTIME_DIR, "dist", "serve-entry.js");
  const result = spawnSync(process.execPath, [entry, "--help"], {
    cwd: QIONGQI_RUNTIME_DIR,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    fail(
      "resources/qiongqi deployed serve entry imports",
      (result.stderr || result.stdout || `node exited with ${result.status}`).trim(),
    );
  } else {
    pass("resources/qiongqi deployed serve entry imports");
  }
}

function collectEntries(rootDir, relativeRoot) {
  const entries = [];
  walkEntries(rootDir, relativeRoot, entries);
  return entries;
}

function walkEntries(dir, relativeDir, entries) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;
    entries.push(relativePath);
    if (entry.isDirectory()) {
      walkEntries(join(dir, entry.name), relativePath, entries);
    }
  }
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
if (requirePath(QIONGQI_RUNTIME_DIR, "resources/qiongqi deployed runtime")) {
  requirePath(
    join(QIONGQI_RUNTIME_DIR, "dist", "serve-entry.js"),
    "resources/qiongqi deployed serve entry",
  );
  requirePath(
    join(QIONGQI_RUNTIME_DIR, "node_modules"),
    "resources/qiongqi deployed node_modules",
  );
  verifyQiongqiRuntimeDirectory();
}
if (requiresQiongqiRuntimeArchive()) {
  if (requirePath(QIONGQI_RUNTIME_ARCHIVE, "resources/qiongqi-runtime.tar.gz")) {
    verifyQiongqiRuntimeArchive();
  }
} else {
  pass("resources/qiongqi-runtime.tar.gz optional on this platform");
}

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
