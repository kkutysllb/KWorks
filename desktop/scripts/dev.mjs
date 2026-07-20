/**
 * Development launcher for the Electron desktop shell.
 *
 * Boots three processes and wires them together:
 *   1. The Node/QiongQi gateway via the vendored runtime
 *   2. The Next.js dev server on port 18659
 *   3. Electron, pointed at the dev server via KWORKS_DEV_SERVER=1
 *
 * Ctrl-C tears everything down cleanly.
 */

import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(DESKTOP_DIR, "..");
const FRONTEND_DIR = resolve(REPO_ROOT, "frontend");
const QIONGQI_DIR = resolve(REPO_ROOT, "qiongqi");
// Sibling KSkills repo (financial quant skill packages). May not exist in
// all environments — checked with existsSync before use.
const KSKILLS_DIR = resolve(REPO_ROOT, "..", "KSkills");
const GATEWAY_PORT = process.env.GATEWAY_PORT ?? "19987";
const DEV_SERVER_PORT = "18659";
const DEV_SERVER_URL = `http://127.0.0.1:${DEV_SERVER_PORT}`;
const FRONTEND_READY_TIMEOUT_MS = 60_000;
const GATEWAY_READY_TIMEOUT_MS = 30_000;
const DESKTOP_DEV_ORIGINS = [
  "app://-",
  `http://127.0.0.1:${DEV_SERVER_PORT}`,
  `http://localhost:${DEV_SERVER_PORT}`,
].join(",");

/** Track child processes so we can tear them down on exit. */
const children = [];
let shuttingDown = false;
let gatewayProcess = null;
let gatewayRestartTimer = null;
let resolveQiongqiLaunchConfig = null;
let qiongqiStorageBackend = null;
let qiongqiConfigFromLaunchConfig = null;

function start(cmd, args, opts = {}) {
  const { onExit, onStdout, onStderr, detached, ...spawnOpts } = opts;
  const child = spawn(cmd, args, {
    stdio: onStdout || onStderr ? ["inherit", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
    // POSIX: put each child in its own process group so teardown can kill the
    // entire group (including grandchildren spawned by pnpm exec / node)
    // with a single negative-PID signal. Without this, killing the direct
    // child leaves grandchildren as orphans still bound to ports (e.g. 19987)
    // or holding .next/dev/lock. Windows has no process groups, so disabled.
    detached: process.platform !== "win32" && detached !== false,
    ...spawnOpts,
  });
  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      if (typeof onStdout === "function") {
        onStdout(String(chunk));
      }
    });
  }
  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      if (typeof onStderr === "function") {
        onStderr(String(chunk));
      }
    });
  }
  children.push(child);
  child.on("exit", (code, signal) => {
    const childIndex = children.indexOf(child);
    if (childIndex >= 0) {
      children.splice(childIndex, 1);
    }
    if (!shuttingDown) {
      console.log(`[dev] ${cmd} exited (code=${code})`);
    }
    if (typeof onExit === "function") {
      onExit(code, signal);
    }
  });
  return child;
}

function scheduleGatewayRestart() {
  if (shuttingDown || gatewayRestartTimer) return;
  gatewayRestartTimer = setTimeout(() => {
    gatewayRestartTimer = null;
    if (!shuttingDown) {
      startGateway();
    }
  }, 1200);
}

function runCapture(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
    child.on("exit", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

async function findGatewayListenerPids(port) {
  if (process.platform === "win32") return [];
  const result = await runCapture("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"]);
  if (result.code !== 0 && !result.stdout.trim()) return [];
  return Array.from(new Set(
    result.stdout
      .split(/\s+/)
      .map((part) => Number.parseInt(part, 10))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid),
  ));
}

function findFrontendListenerPids(port) {
  return findGatewayListenerPids(port);
}

async function assertExistingGatewayIsQiongQi(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/ready`, {
      signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) {
      throw new Error(`/ready returned ${response.status}`);
    }
    const body = await response.json();
    if (body?.service !== "qiongqi") {
      throw new Error(`unexpected service ${JSON.stringify(body?.service)}`);
    }
  } catch (error) {
    throw new Error(
      `port ${port} is already in use, but it is not a QiongQi gateway (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

async function waitForProcessExit(pid, timeoutMs = 5000) {
  const startAt = Date.now();
  while (Date.now() - startAt < timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await sleep(100);
  }
  throw new Error(`process ${pid} did not exit within ${timeoutMs}ms`);
}

async function clearStaleGatewayListeners(port) {
  const pids = await findGatewayListenerPids(port);
  if (pids.length === 0) return;
  await assertExistingGatewayIsQiongQi(port);
  console.log(`[dev] clearing stale QiongQi gateway listener(s) on ${port}: ${pids.join(", ")}`);
  for (const pid of pids) {
    for (const signal of ["SIGTERM", "SIGKILL"]) {
      try {
        process.kill(pid, signal);
      } catch {
        break;
      }
      try {
        await waitForProcessExit(pid, signal === "SIGTERM" ? 3000 : 1200);
        break;
      } catch (error) {
        if (signal === "SIGKILL") throw error;
      }
    }
  }
}

async function clearStaleFrontendListeners(port) {
  const pids = await findFrontendListenerPids(port);
  if (pids.length === 0) return;
  console.log(`[dev] clearing stale Next.js listener(s) on ${port}: ${pids.join(", ")}`);
  for (const pid of pids) {
    for (const signal of ["SIGTERM", "SIGKILL"]) {
      try {
        process.kill(pid, signal);
      } catch {
        break;
      }
      try {
        await waitForProcessExit(pid, signal === "SIGTERM" ? 3000 : 1200);
        break;
      } catch (error) {
        if (signal === "SIGKILL") throw error;
      }
    }
  }
}

function clearFrontendBuildArtifacts() {
  for (const path of [join(FRONTEND_DIR, ".next"), join(FRONTEND_DIR, "out")]) {
    if (!existsSync(path)) continue;
    rmSync(path, { recursive: true, force: true });
    console.log(`[dev] removed stale frontend artifact ${path}`);
  }
}

function teardown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n[dev] shutting down...");
  if (gatewayRestartTimer) {
    clearTimeout(gatewayRestartTimer);
    gatewayRestartTimer = null;
  }
  for (const child of [...children].reverse()) {
    try {
      // Kill the entire process group (negative PID). Each child was started
      // with detached: true, so it is the leader of its own group; the signal
      // propagates to all descendants (e.g. pnpm exec → next dev → next-server,
      // or node → qiongqi serve), preventing the orphan-process port/lock leaks
      // we hit on plain Ctrl+C.
      process.kill(-child.pid, signal);
    } catch (e) {
      if (e && e.code === "EPERM") {
        // Different session (rare on macOS); fall back to PID-only kill.
        try { process.kill(child.pid, signal); } catch { /* already dead */ }
      }
      /* ESRCH or already dead — ignore */
    }
  }
  // Graceful exit: give children 5s to clean up (delete .next/dev/lock, close
  // webpack watcher, release ports, etc.). Next.js dev server needs 3-5s to
  // release its lockfile; anything shorter leaves a stale "Unable to acquire
  // lock" state on the next `pnpm run dev`. Escalate to SIGKILL for any
  // stubborn survivors after 3s.
  const forceKillTimer = setTimeout(() => {
    for (const child of [...children]) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* already dead */
      }
    }
  }, 3000);
  setTimeout(() => {
    clearTimeout(forceKillTimer);
    process.exit(0);
  }, 5000);
}

process.on("SIGINT", () => teardown("SIGINT"));
process.on("SIGTERM", () => teardown("SIGTERM"));

// ── 1. Gateway (Node/QiongQi) ─────────────────────────────────────────────
// In dev mode the gateway is launched here (not via backend.ts), so this
// script must inject the SAME isolation env vars that backend.ts does in
// production: KWorks_HOME, KWorks_SKILLS_PATH, and
// KWorks_CODING_HOME.
//
// IMPORTANT: dev mode paths must mirror paths.ts — the desktop app home is
// ~/.kworks-workspace (NOT the legacy ~/Library/Application Support/...).
// This is critical for verifying the new directory layout, granted_paths.json
// authorization flow, and coding home isolation without a full package build.
const DESKTOP_HOME =
  process.env.HOME && join(process.env.HOME, ".kworks-workspace");
const CODING_HOME =
  process.env.HOME && join(process.env.HOME, ".kworks-coding-desktop");

function initDesktopExtensionsConfig(configPath) {
  if (!configPath || existsSync(configPath)) return;
  writeFileSync(
    configPath,
    `${JSON.stringify({ mcpServers: {}, skills: {} }, null, 2)}\n`,
    "utf8",
  );
  console.log("[dev] initialized desktop extensions config");
}

function syncDesktopPublicSkills(skillsPath) {
  if (!skillsPath) return;
  const publicTarget = join(skillsPath, "public");
  const builtinCoreTarget = join(skillsPath, "builtin", "core");
  const builtinTaskTarget = join(skillsPath, "builtin", "task");
  const builtinCodingTarget = join(skillsPath, "builtin", "coding");
  const builtinFinanceTarget = join(skillsPath, "builtin", "finance");

  // Also create the writable custom/ directory so users can create skills
  // at runtime (mirrors backend.ts initSkills).
  const customTarget = join(skillsPath, "custom");
  const customSharedTarget = join(customTarget, "shared");
  for (const dir of [
    publicTarget,
    builtinCoreTarget,
    builtinTaskTarget,
    builtinCodingTarget,
    builtinFinanceTarget,
    customSharedTarget,
  ]) {
    mkdirSync(dir, { recursive: true });
  }

  const bundledPublic = join(REPO_ROOT, "skills", "public");
  let copiedPublic = 0;
  let copiedUnified = 0;
  if (existsSync(bundledPublic)) {
    for (const name of readdirSync(bundledPublic)) {
      const src = join(bundledPublic, name);
      if (!statSync(src).isDirectory()) continue;
      copiedPublic += copyMissingSkill(src, join(publicTarget, name));
      if (name === "coding") {
        copiedUnified += copyMissingChildren(src, builtinCodingTarget);
        continue;
      }
      copiedUnified += copyMissingSkill(
        src,
        join(targetForPublicDevSkill(name, {
          builtinCoreTarget,
          builtinTaskTarget,
        }), name),
      );
    }
  } else {
    console.warn(`[dev] bundled skills/public not found at ${bundledPublic}`);
  }

  const qiongqiSkillRoot = join(QIONGQI_DIR, "skills");
  let copiedQiongqi = 0;
  if (existsSync(qiongqiSkillRoot)) {
    for (const name of readdirSync(qiongqiSkillRoot)) {
      const src = join(qiongqiSkillRoot, name);
      if (!statSync(src).isDirectory()) continue;
      const targetParent = ["goal", "todo", "web"].includes(name)
        ? builtinCoreTarget
        : builtinCodingTarget;
      copiedQiongqi += copyMissingSkill(src, join(targetParent, name));
    }
  } else {
    console.warn(`[dev] qiongqi built-in skills not found at ${qiongqiSkillRoot}`);
  }

  // Sync financial quant skills from the sibling KSkills repo (stock + common).
  let copiedFinance = 0;
  if (existsSync(KSKILLS_DIR)) {
    for (const category of ["stock", "common"]) {
      const categoryDir = join(KSKILLS_DIR, category);
      if (!existsSync(categoryDir)) continue;
      for (const name of readdirSync(categoryDir)) {
        const src = join(categoryDir, name);
        if (!statSync(src).isDirectory()) continue;
        if (!existsSync(join(src, "SKILL.md"))) continue;
        copiedFinance += copyMissingSkill(src, join(builtinFinanceTarget, name));
      }
    }
  } else {
    console.warn(`[dev] KSkills repo not found at ${KSKILLS_DIR} — finance skills will not be synced`);
  }

  if (copiedPublic > 0) {
    console.log(`[dev] synced ${copiedPublic} public skill(s) to ${publicTarget}`);
  }
  if (copiedUnified > 0 || copiedQiongqi > 0) {
    console.log(`[dev] synced ${copiedUnified + copiedQiongqi} skill(s) into unified roots under ${skillsPath}`);
  }
  if (copiedFinance > 0) {
    console.log(`[dev] synced ${copiedFinance} finance skill(s) to ${builtinFinanceTarget}`);
  }
}

function targetForPublicDevSkill(name, targets) {
  if (["bootstrap", "find-skills", "skill-creator", "skill-manage"].includes(name)) {
    return targets.builtinCoreTarget;
  }
  return targets.builtinTaskTarget;
}

function copyMissingChildren(srcParent, dstParent) {
  if (!existsSync(srcParent)) return 0;
  let copied = 0;
  for (const name of readdirSync(srcParent)) {
    const src = join(srcParent, name);
    if (!statSync(src).isDirectory()) continue;
    copied += copyMissingSkill(src, join(dstParent, name));
  }
  return copied;
}

function copyMissingSkill(src, dst) {
  if (existsSync(dst)) return 0;
  cpSync(src, dst, { recursive: true });
  return 1;
}

function ensureVendoredQiongqiRuntime() {
  const packageJson = join(QIONGQI_DIR, "package.json");
  const serveEntry = join(QIONGQI_DIR, "packages", "cli-layer", "cli", "src", "serve-entry.ts");
  const builtServeEntry = join(QIONGQI_DIR, "packages", "cli-layer", "cli", "dist", "serve-entry.js");
  if (!existsSync(packageJson) || !existsSync(serveEntry)) {
    throw new Error(`[dev] vendored QiongQi runtime source is missing at ${QIONGQI_DIR}`);
  }

  if (existsSync(builtServeEntry) && !isVendoredQiongqiSourceNewerThanBuild(builtServeEntry)) {
    return;
  }

  console.log("[dev] preparing vendored QiongQi runtime...");
  const prepare = spawn(
    process.platform === "win32" ? "cmd.exe" : "sh",
    process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm install --silent && pnpm run build"]
      : ["-c", "pnpm install --silent && pnpm run build"],
    { cwd: QIONGQI_DIR, stdio: "inherit" },
  );
  prepare.on("exit", (code) => {
    if (code !== 0) {
      console.error("[dev] QiongQi runtime preparation failed; aborting.");
      process.exit(1);
    }
  });
  return prepare;
}

function isVendoredQiongqiSourceNewerThanBuild(builtServeEntry) {
  const builtAt = statSync(builtServeEntry).mtimeMs;
  const sourceRoots = ["packages", "src", "scripts"].map((name) => join(QIONGQI_DIR, name));
  const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json"]);
  const stack = sourceRoots.filter((path) => existsSync(path));
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }
      if (!sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) continue;
      if (statSync(path).mtimeMs > builtAt) return true;
    }
  }
  return false;
}

function startGateway() {
  // Mirror backend.ts buildEnv(): flat layout under ~/.kworks-workspace
  // (same as paths.ts getAppDataDir / getKworksHome).
  const kkworksHome = DESKTOP_HOME;
  const extensionsConfigPath = kkworksHome ? join(kkworksHome, "extensions_config.json") : undefined;
  const dataDir = kkworksHome ? join(kkworksHome, "data") : undefined;
  // Unified runtime data dir — must match backend.ts buildEnv() which uses
  // kworksUserWorkspacePaths(root, "runtime").userRoot = <root>/users/runtime.
  const runtimeDataDir = kkworksHome ? join(kkworksHome, "users", "runtime") : undefined;
  const skillsPath = kkworksHome ? join(kkworksHome, "skills") : undefined;

  // Ensure the isolated state dir exists (matches backend.ts ensureDataDirs).
  if (kkworksHome) {
    for (const sub of ["", "logs", "users/runtime", "system/data"]) {
      mkdirSync(join(kkworksHome, sub), { recursive: true });
    }
    // Ensure coding home exists (matches backend.ts ensureDataDirs).
    if (CODING_HOME) {
      mkdirSync(CODING_HOME, { recursive: true });
    }
    initDesktopExtensionsConfig(extensionsConfigPath);
    syncDesktopPublicSkills(skillsPath);
  }

  console.log(`[dev] starting gateway on port ${GATEWAY_PORT}...`);
  console.log(`[dev]   KWorks_HOME=${kkworksHome}`);
  console.log(`[dev]   KWorks_CODING_HOME=${CODING_HOME}`);
  console.log(`[dev]   KWorks_EXTENSIONS_CONFIG_PATH=${extensionsConfigPath}`);
  console.log(`[dev]   KWorks_DATA_DIR=${dataDir}`);
  console.log(`[dev]   QIONGQI_DATA_DIR=${runtimeDataDir}`);
  console.log(`[dev]   KWorks_SKILLS_PATH=${skillsPath}`);
  if (!resolveQiongqiLaunchConfig || !qiongqiStorageBackend || !qiongqiConfigFromLaunchConfig) {
    throw new Error("qiongqi launch config module was not loaded");
  }
  const qiongqiLaunchConfig = resolveQiongqiLaunchConfig({
    env: process.env,
  });
  const storageBackend = qiongqiStorageBackend(process.env);
  console.log(`[dev]   QIONGQI_MODEL=${qiongqiLaunchConfig.model ?? "(not configured)"}`);
  console.log(`[dev]   QIONGQI_BASE_URL=${qiongqiLaunchConfig.baseUrl}`);
  console.log(`[dev]   QIONGQI_CONFIG_SOURCE=${qiongqiLaunchConfig.source}`);
  console.log(`[dev]   QIONGQI_STORAGE_BACKEND=${storageBackend}`);
  const qiongqiConfigPath = kkworksHome ? join(kkworksHome, "qiongqi-config.json") : join(QIONGQI_DIR, ".dev-qiongqi-config.json");
  writeFileSync(
    qiongqiConfigPath,
    `${JSON.stringify(qiongqiConfigFromLaunchConfig(qiongqiLaunchConfig), null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  const qiongqiEntry = join(QIONGQI_DIR, "packages", "cli-layer", "cli", "dist", "serve-entry.js");
  gatewayProcess = start(process.execPath, [
    qiongqiEntry,
    "serve",
    "--config",
    qiongqiConfigPath,
    "--preset",
    "coding",
    "--host",
    "127.0.0.1",
    "--port",
    GATEWAY_PORT,
    "--data-dir",
    runtimeDataDir ?? join(QIONGQI_DIR, ".dev-data"),
    "--storage-backend",
    storageBackend,
    "--insecure",
  ], {
    cwd: QIONGQI_DIR,
    env: {
      ...process.env,
      GATEWAY_HOST: "127.0.0.1",
      GATEWAY_PORT,
      GATEWAY_CORS_ORIGINS: DESKTOP_DEV_ORIGINS,
      CORS_ORIGINS: DESKTOP_DEV_ORIGINS,
      KWorks_DESKTOP_DEV: "1",
      KWorks_QIONGQI_REPO_PATH: QIONGQI_DIR,
      QIONGQI_HOST: "127.0.0.1",
      QIONGQI_PORT: GATEWAY_PORT,
      QIONGQI_DATA_DIR: runtimeDataDir ?? join(QIONGQI_DIR, ".dev-data"),
      QIONGQI_STORAGE_BACKEND: storageBackend,
      QIONGQI_API_KEY: qiongqiLaunchConfig.apiKey,
      QIONGQI_BASE_URL: qiongqiLaunchConfig.baseUrl,
      ...(qiongqiLaunchConfig.model ? { QIONGQI_MODEL: qiongqiLaunchConfig.model } : {}),
      // Isolation: desktop state under ~/.kworks-workspace (matching paths.ts).
      ...(kkworksHome ? { KWorks_HOME: kkworksHome } : {}),
      ...(CODING_HOME ? { KWorks_CODING_HOME: CODING_HOME } : {}),
      ...(extensionsConfigPath ? { KWorks_EXTENSIONS_CONFIG_PATH: extensionsConfigPath } : {}),
      ...(dataDir ? { KWorks_DATA_DIR: dataDir } : {}),
      ...(skillsPath ? { KWorks_SKILLS_PATH: skillsPath } : {}),
    },
    onExit: () => {
      gatewayProcess = null;
      scheduleGatewayRestart();
    },
  });
}

async function waitForGatewayReady(port) {
  const deadline = Date.now() + GATEWAY_READY_TIMEOUT_MS;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (!health.ok) {
        lastError = `/health returned ${health.status}`;
        await sleep(250);
        continue;
      }

      const crons = await fetch(`http://127.0.0.1:${port}/api/crons`, {
        signal: AbortSignal.timeout(1000),
      });
      if (crons.status === 404) {
        throw new Error("compatibility route /api/crons returned 404; QiongQi dist is stale or the old gateway is still serving");
      }
      if (!crons.ok) {
        lastError = `/api/crons returned ${crons.status}`;
        await sleep(250);
        continue;
      }

      const usage = await fetch(`http://127.0.0.1:${port}/api/usage?group_by=model&window=month`, {
        signal: AbortSignal.timeout(1000),
      });
      if (usage.status === 404) {
        throw new Error("compatibility route /api/usage returned 404; QiongQi dist is stale or the old gateway is still serving");
      }
      if (!usage.ok) {
        lastError = `/api/usage returned ${usage.status}`;
        await sleep(250);
        continue;
      }
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (
        lastError.includes("compatibility route /api/crons returned 404") ||
        lastError.includes("compatibility route /api/usage returned 404")
      ) {
        throw error;
      }
      await sleep(250);
    }
  }
  throw new Error(`QiongQi gateway did not become ready on ${port}: ${lastError}`);
}

// ── 2. Next.js dev server ────────────────────────────────────────────────
// IMPORTANT: dev mode does NOT set DESKTOP_BUILD. Static export is only used
// by `desktop-build.mjs` for packaged Electron builds.
//
// In Electron-only mode the Next dev server is only the renderer hot-reload
// host. Browser APIs call the desktop gateway directly via getBackendBaseURL(),
// with CORS allowed by DESKTOP_DEV_ORIGINS below.
let frontendReadyPromise = null;

function startFrontend() {
  console.log(`[dev] starting Next.js dev server on port ${DEV_SERVER_PORT}...`);
  let markReady;
  frontendReadyPromise = new Promise((resolve) => {
    markReady = resolve;
  });
  start(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", DEV_SERVER_PORT],
    {
      cwd: FRONTEND_DIR,
      env: {
        ...process.env,
        GATEWAY_PORT,
      },
      onStdout: (chunk) => {
        if (chunk.includes("Ready in")) {
          markReady();
        }
      },
      onStderr: (chunk) => {
        if (chunk.includes("Ready in")) {
          markReady();
        }
      },
    },
  );
  return frontendReadyPromise;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFrontendReady() {
  if (!frontendReadyPromise) {
    throw new Error("Frontend dev server has not been started");
  }
  await Promise.race([
    frontendReadyPromise,
    sleep(FRONTEND_READY_TIMEOUT_MS).then(() => {
      throw new Error(`Next.js dev server did not become ready at ${DEV_SERVER_URL}`);
    }),
  ]);
}

// ── 3. Electron ──────────────────────────────────────────────────────────
function startElectron() {
  console.log(`[dev] starting Electron (loading ${DEV_SERVER_URL})...`);
  start(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "electron", "."],
    {
      cwd: DESKTOP_DIR,
      env: {
        ...process.env,
        KWORKS_DEV_SERVER: "1",
        KWORKS_SKIP_BACKEND_AUTOLAUNCH: "1",
        GATEWAY_PORT,
      },
    },
  );
}

// ── Boot order: compile preload, then launch everything ───────────────────
async function main() {
  // Ensure the main/preload TS is compiled first.
  console.log("[dev] compiling main process...");
  try {
    spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["run", "build"],
      { cwd: DESKTOP_DIR, stdio: "inherit" },
    ).on("exit", (code) => {
      if (code !== 0) {
        console.error("[dev] TS build failed; aborting.");
        process.exit(1);
      }
      import("../dist/qiongqi-launch-config.js")
        .then(async (launchConfigModule) => {
          resolveQiongqiLaunchConfig = launchConfigModule.resolveQiongqiLaunchConfig;
          qiongqiStorageBackend = launchConfigModule.qiongqiStorageBackend;
          qiongqiConfigFromLaunchConfig = launchConfigModule.qiongqiConfigFromLaunchConfig;
          const qiongqiInstall = ensureVendoredQiongqiRuntime();
          if (qiongqiInstall) {
            await new Promise((resolve, reject) => {
              qiongqiInstall.on("exit", (code) => {
                if (code === 0) {
                  resolve();
                } else {
                  reject(new Error(`QiongQi dependency install failed with code ${code}`));
                }
              });
            });
          }
          await clearStaleGatewayListeners(GATEWAY_PORT);
          await clearStaleFrontendListeners(DEV_SERVER_PORT);
          clearFrontendBuildArtifacts();
          startGateway();
          await waitForGatewayReady(GATEWAY_PORT);
          startFrontend();
          await waitForFrontendReady();
          startElectron();
        })
        .catch((e) => {
          console.error("[dev] failed to start desktop dev environment:", e);
          process.exit(1);
        });
    });
  } catch (e) {
    console.error("[dev] failed to start:", e);
    process.exit(1);
  }
}

main();
