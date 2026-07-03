#!/usr/bin/env node

import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const DESKTOP_DIR = resolve(SCRIPT_DIR, "..");
const RELEASE_DIR = join(DESKTOP_DIR, "release");
const REQUIRED_RUNTIME_PACKAGES = [
  "@qiongqi/http",
  "@qiongqi/contracts",
  "@qiongqi/preset-coding",
];

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

function collectResourceDirs() {
  const explicit = process.env.KWORKS_PACKAGED_RESOURCES_DIR;
  if (explicit) return [resolve(explicit)];

  const platform = process.env.KWORKS_PACKAGE_PLATFORM;
  if (platform === "win") return [join(RELEASE_DIR, "win-unpacked", "resources")];
  if (platform === "linux") return [join(RELEASE_DIR, "linux-unpacked", "resources")];
  if (platform === "mac") return findMacResourceDirs();

  return [
    join(RELEASE_DIR, "win-unpacked", "resources"),
    join(RELEASE_DIR, "linux-unpacked", "resources"),
    ...findMacResourceDirs(),
  ].filter((dir) => existsSync(dir));
}

function findMacResourceDirs() {
  const result = [];
  walkDirs(RELEASE_DIR, 0, (dir) => {
    if (dir.endsWith(".app/Contents/Resources") && existsSync(join(dir, "app.asar"))) {
      result.push(dir);
      return false;
    }
    return true;
  });
  return result;
}

function walkDirs(dir, depth, onDir) {
  if (!existsSync(dir) || depth > 8) return;
  if (!onDir(dir)) return;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "node_modules" || entry.name === "qiongqi") continue;
    walkDirs(join(dir, entry.name), depth + 1, onDir);
  }
}

function verifyResourceDir(resourcesDir) {
  const label = resourcesDir.replace(`${DESKTOP_DIR}/`, "");
  requirePath(join(resourcesDir, "frontend-out", "index.html"), `${label} frontend`);
  requirePath(join(resourcesDir, "skills"), `${label} skills`);

  const archive = join(resourcesDir, "qiongqi-runtime.tar.gz");
  if (requirePath(archive, `${label} QiongQi runtime archive`)) {
    verifyRuntimeArchive(archive, label);
  }
}

function verifyRuntimeArchive(archive, label) {
  const result = spawnSync("tar", ["-tzf", basename(archive)], {
    cwd: dirname(archive),
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    fail(
      `${label} QiongQi runtime archive contents`,
      result.stderr?.trim() || result.stdout?.trim() || "Unable to list archive",
    );
    return;
  }

  verifyRuntimeListing(`${label} QiongQi runtime archive`, result.stdout ?? "");
}

function verifyRuntimeListing(label, listing) {
  const requiredEntries = [
    "qiongqi/dist/serve-entry.js",
    ...REQUIRED_RUNTIME_PACKAGES.map(
      (packageName) => `qiongqi/node_modules/${packageName}/package.json`,
    ),
  ];

  for (const entry of requiredEntries) {
    if (listing.includes(entry)) {
      pass(`${label} contains ${entry}`);
    } else {
      fail(`${label} contains ${entry}`, "Missing from archive listing");
    }
  }
}

const resourcesDirs = collectResourceDirs();
if (resourcesDirs.length === 0) {
  fail("packaged resources directory", `No packaged Resources directory found under ${RELEASE_DIR}`);
}

for (const resourcesDir of resourcesDirs) {
  if (requirePath(resourcesDir, `packaged resources ${resourcesDir}`)) {
    verifyResourceDir(resourcesDir);
  }
}

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  const prefix = check.ok ? "[OK]" : "[FAIL]";
  console.log(`${prefix} ${check.label}`);
  if (!check.ok && check.detail) console.log(`       ${check.detail}`);
}

if (failed.length > 0) {
  console.error(
    `\nBuilt package resource verification failed: ${failed.length} check(s) failed.`,
  );
  process.exit(1);
}

console.log("\nBuilt package resources are complete.");
