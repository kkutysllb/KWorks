#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import process from "node:process";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const DESKTOP_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(DESKTOP_DIR, "..");
const QIONGQI_DIR = join(REPO_ROOT, "qiongqi");
const BUILD_DIR = join(DESKTOP_DIR, "build");
const RUNTIME_ARCHIVE_RELATIVE = "build/qiongqi-runtime.tar.gz";
const RUNTIME_ARCHIVE = join(BUILD_DIR, "qiongqi-runtime.tar.gz");
const RUNTIME_STAGING_DIR = join(BUILD_DIR, "qiongqi-runtime");
const RUNTIME_STAGING_QIONGQI_DIR = join(RUNTIME_STAGING_DIR, "qiongqi");
const PNPM = resolvePnpmCommand();
const require = createRequire(import.meta.url);
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

function envFlag(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return undefined;
  return !/^(0|false|no|off)$/i.test(raw);
}

function shouldPrepareQiongqiArchive() {
  return envFlag("KWORKS_PREPARE_QIONGQI_ARCHIVE") ?? true;
}

function shouldSignQiongqiArchive() {
  if (process.platform !== "darwin") return false;
  if (envFlag("KWORKS_SIGN_QIONGQI_ARCHIVE") === true) return true;
  return Boolean(
    process.env.CI === "true" &&
      process.env.APPLE_ID &&
      process.env.APPLE_APP_SPECIFIC_PASSWORD &&
      process.env.APPLE_TEAM_ID &&
      process.env.CSC_IDENTITY_AUTO_DISCOVERY !== "false",
  );
}

function resolvePnpmCommand() {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && /(^|[/\\])pnpm(\.(cjs|mjs|js))?$/i.test(npmExecPath)) {
    if (/\.(cjs|mjs|js)$/i.test(npmExecPath)) {
      return { command: process.execPath, args: [npmExecPath] };
    }
    return { command: npmExecPath, args: [] };
  }
  return {
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args: [],
  };
}

function run(command, args, options, failureMessage) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.status !== 0) {
    console.error(`[FAIL] ${failureMessage}`);
    process.exit(result.status ?? 1);
  }
  return result;
}

requirePath(
  join(QIONGQI_DIR, "packages", "cli-layer", "cli", "dist", "serve-entry.js"),
  "QiongQi built serve entry",
);
requirePath(join(QIONGQI_DIR, "node_modules"), "QiongQi node_modules");

const buildResult = spawnSync(process.execPath, [join(QIONGQI_DIR, "scripts", "build.mjs")], {
  cwd: QIONGQI_DIR,
  stdio: "inherit",
  windowsHide: true,
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
rmSync(RUNTIME_STAGING_DIR, { recursive: true, force: true });
mkdirSync(RUNTIME_STAGING_DIR, { recursive: true });

run(
  PNPM.command,
  [
    ...PNPM.args,
    "--config.node-linker=hoisted",
    "--dir",
    QIONGQI_DIR,
    "--filter",
    "@qiongqi/cli",
    "deploy",
    "--legacy",
    "--prod",
    RUNTIME_STAGING_QIONGQI_DIR,
  ],
  { cwd: REPO_ROOT },
  "Failed to create production QiongQi deploy runtime",
);

requirePath(
  join(RUNTIME_STAGING_QIONGQI_DIR, "dist", "serve-entry.js"),
  "QiongQi deployed serve entry",
);
requirePath(
  join(RUNTIME_STAGING_QIONGQI_DIR, "node_modules"),
  "QiongQi deployed node_modules",
);
copyQiongqiBuiltinSkills();

await rebuildQiongqiRuntimeForElectron();

if (!shouldPrepareQiongqiArchive()) {
  console.log(`[OK] Prepared QiongQi production runtime at ${RUNTIME_STAGING_QIONGQI_DIR}`);
  process.exit(0);
}

signMacNativeBinaries(RUNTIME_STAGING_QIONGQI_DIR);

run(
  "tar",
  ["-czf", RUNTIME_ARCHIVE_RELATIVE, "-C", RUNTIME_STAGING_DIR, "qiongqi"],
  { cwd: DESKTOP_DIR },
  `Failed to create ${RUNTIME_ARCHIVE}`,
);

console.log(`[OK] Created ${RUNTIME_ARCHIVE}`);

function copyQiongqiBuiltinSkills() {
  const source = join(QIONGQI_DIR, "skills");
  const target = join(RUNTIME_STAGING_QIONGQI_DIR, "skills");
  requirePath(join(source, "tdd", "skill.json"), "QiongQi built-in skill tdd");
  cpSync(source, target, { recursive: true });
  requirePath(join(target, "tdd", "skill.json"), "QiongQi deployed built-in skill tdd");
}

async function rebuildQiongqiRuntimeForElectron() {
  const { rebuild } = require("@electron/rebuild");
  const { version: electronVersion } = require("electron/package.json");

  console.log(
    `[OK] Rebuilding QiongQi native runtime modules for Electron ${electronVersion}`,
  );

  await rebuild({
    buildPath: RUNTIME_STAGING_QIONGQI_DIR,
    electronVersion,
    arch: process.arch,
    force: true,
    // better-sqlite3 compiles from source via node-gyp and MUST be rebuilt for
    // Electron's ABI. sharp uses prebuilt per-platform binaries (@img/sharp-*)
    // that load directly under ELECTRON_RUN_AS_NODE=1, but we include it here
    // so @electron/rebuild validates its binding against the runtime too.
    onlyModules: ["better-sqlite3", "sharp"],
    types: ["prod", "optional"],
    mode: "sequential",
  });
}

function signMacNativeBinaries(rootDir) {
  if (!shouldSignQiongqiArchive()) {
    console.log("[OK] QiongQi native signing skipped; notarization signing is not required");
    return;
  }

  const identity = resolveDeveloperIdIdentity();
  if (!identity) {
    console.error("[FAIL] No Developer ID Application identity found for QiongQi runtime signing");
    process.exit(1);
  }

  const nativeBinaries = findMacNativeBinaries(rootDir);
  if (nativeBinaries.length === 0) {
    console.log("[OK] No macOS native binaries found in QiongQi runtime");
    return;
  }

  for (const binary of nativeBinaries) {
    run(
      "codesign",
      ["--force", "--sign", identity, "--options", "runtime", "--timestamp", binary],
      {},
      `Failed to codesign ${binary}`,
    );
  }

  console.log(`[OK] Signed ${nativeBinaries.length} QiongQi native runtime file(s)`);
}

function resolveDeveloperIdIdentity() {
  if (process.env.CSC_NAME) return process.env.CSC_NAME;

  const result = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return null;

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/"([^"]*Developer ID Application[^"]*)"/);
    if (match) return match[1];
  }
  return null;
}

function findMacNativeBinaries(rootDir) {
  const binaries = [];
  walkFiles(rootDir, (filePath) => {
    if (!isNativeBinaryCandidate(filePath)) return;
    if (isMachOBinary(filePath)) binaries.push(filePath);
  });
  return binaries;
}

function walkFiles(dir, onFile) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walkFiles(path, onFile);
    } else if (entry.isFile()) {
      onFile(path);
    }
  }
}

function isNativeBinaryCandidate(filePath) {
  if (filePath.endsWith(".node") || filePath.endsWith(".dylib")) return true;
  return Boolean(statSync(filePath).mode & 0o111);
}

function isMachOBinary(filePath) {
  const result = spawnSync("file", ["-b", filePath], {
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0 && /Mach-O/.test(result.stdout ?? "");
}
