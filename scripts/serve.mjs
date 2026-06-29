#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const FRONTEND_DIR = join(REPO_ROOT, "frontend");
const QIONGQI_DIR = join(REPO_ROOT, "qiongqi");
const LOG_DIR = join(REPO_ROOT, "logs");
const PID_DIR = join(REPO_ROOT, ".pids");
const GATEWAY_PORT = Number(process.env.GATEWAY_PORT ?? "9193");
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? "9192");
const GATEWAY_HOST = "127.0.0.1";
const GATEWAY_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;
const RUNTIME_BOOTSTRAP_USER_ID = "runtime";

const children = [];
let stopping = false;

function usage() {
  console.log(`Usage:
  node scripts/serve.mjs start [dev|prod]
  node scripts/serve.mjs stop
  node scripts/serve.mjs status

Environment:
  GATEWAY_PORT     default 9193
  FRONTEND_PORT    default 9192
  QIONGQI_MODEL    optional bootstrap model id
  QIONGQI_API_KEY  model provider key
  QIONGQI_BASE_URL default https://api.deepseek.com`);
}

function pidFile(name) {
  return join(PID_DIR, `${name}.pid`);
}

function logFile(name) {
  return join(LOG_DIR, `${name}.log`);
}

function readPid(name) {
  try {
    const pid = Number(readFileSync(pidFile(name), "utf8").trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopByPid(name) {
  const pid = readPid(name);
  if (pid && isAlive(pid)) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already stopped
      }
    }
  }
  rmSync(pidFile(name), { force: true });
}

async function waitForHealth(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function spawnManaged(name, command, args, options = {}) {
  mkdirSync(LOG_DIR, { recursive: true });
  mkdirSync(PID_DIR, { recursive: true });
  const out = spawn(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    shell: process.platform === "win32"
  });
  const logPath = logFile(name);
  const append = (chunk) => {
    process.stdout.write(chunk);
    writeFileSync(logPath, chunk, { flag: "a" });
  };
  out.stdout.on("data", append);
  out.stderr.on("data", append);
  children.push(out);
  writeFileSync(pidFile(name), String(out.pid), "utf8");
  out.on("exit", (code, signal) => {
    rmSync(pidFile(name), { force: true });
    if (!stopping) console.log(`[${name}] exited code=${code} signal=${signal}`);
  });
  return out;
}

function ensureQiongqiEntry() {
  const entry = join(QIONGQI_DIR, "packages", "cli-layer", "cli", "dist", "serve-entry.js");
  if (!existsSync(entry)) {
    throw new Error(`QiongQi serve entry not found: ${entry}. Run: cd qiongqi && pnpm run build`);
  }
  return entry;
}

function resolveQiongqiLaunchConfig() {
  const envModel = firstNonEmpty(process.env.QIONGQI_MODEL, process.env.DEEPSEEK_MODEL);
  const envBaseUrl = firstNonEmpty(process.env.QIONGQI_BASE_URL, process.env.DEEPSEEK_BASE_URL);
  const envApiKey = firstNonEmpty(process.env.QIONGQI_API_KEY, process.env.DEEPSEEK_API_KEY);
  if (envApiKey) {
    return {
      ...(envModel ? { model: envModel } : {}),
      baseUrl: envBaseUrl ?? "https://api.deepseek.com",
      apiKey: envApiKey,
      source: "environment"
    };
  }
  return {
    ...(envModel ? { model: envModel } : {}),
    baseUrl: envBaseUrl ?? "https://api.deepseek.com",
    apiKey: "",
    source: "default",
    models: []
  };
}

function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value.trim().length > 0);
}

function qiongqiStorageBackend() {
  return process.env.QIONGQI_STORAGE_BACKEND === "hybrid" ? "hybrid" : "file";
}

function qiongqiConfigFromLaunchConfig(config) {
  const profiles = {};
  for (const model of config.models ?? []) {
    if (!model.name && !model.model) continue;
    const profileKey = model.name || model.model;
    profiles[profileKey] = {
      aliases: Array.from(new Set([model.model, model.name].filter(Boolean))),
      providerModel: model.model,
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
      ...(model.contextWindowTokens ? { contextWindowTokens: model.contextWindowTokens } : {}),
      ...(model.supportsVision ? { inputModalities: ["text", "image"] } : {}),
      supportsToolCalling: true
    };
  }
  return {
    serve: {
      ...(config.model ? { model: config.model } : {}),
      baseUrl: config.baseUrl,
      apiKey: config.apiKey
    },
    models: { profiles }
  };
}

async function start(mode) {
  const entry = ensureQiongqiEntry();
  stopByPid("gateway");
  stopByPid("frontend");
  const qiongqiLaunchConfig = resolveQiongqiLaunchConfig();
  const storageBackend = qiongqiStorageBackend();
  const qiongqiConfigPath = join(gatewayDataDir(), "config.json");
  mkdirSync(dirname(qiongqiConfigPath), { recursive: true });
  writeFileSync(
    qiongqiConfigPath,
    `${JSON.stringify(qiongqiConfigFromLaunchConfig(qiongqiLaunchConfig), null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 }
  );
  const gatewayEnv = {
    ...process.env,
    QIONGQI_HOST: GATEWAY_HOST,
    QIONGQI_PORT: String(GATEWAY_PORT),
    QIONGQI_DATA_DIR: gatewayDataDir(),
    QIONGQI_STORAGE_BACKEND: storageBackend,
    QIONGQI_API_KEY: qiongqiLaunchConfig.apiKey,
    QIONGQI_BASE_URL: qiongqiLaunchConfig.baseUrl,
    ...(qiongqiLaunchConfig.model ? { QIONGQI_MODEL: qiongqiLaunchConfig.model } : {})
  };
  spawnManaged(
    "gateway",
    process.execPath,
    [
      entry,
      "serve",
      "--config",
      qiongqiConfigPath,
      "--preset",
      "coding",
      "--host",
      GATEWAY_HOST,
      "--port",
      String(GATEWAY_PORT),
      "--data-dir",
      gatewayEnv.QIONGQI_DATA_DIR,
      "--storage-backend",
      storageBackend,
      "--insecure"
    ],
    { cwd: QIONGQI_DIR, env: gatewayEnv }
  );
  if (!(await waitForHealth(`${GATEWAY_URL}/health`))) {
    throw new Error(`QiongQi gateway did not become healthy on ${GATEWAY_URL}`);
  }
  const frontendEnv = {
    ...process.env,
    PORT: String(FRONTEND_PORT),
    NEXT_PUBLIC_BACKEND_BASE_URL: GATEWAY_URL,
    NEXT_PUBLIC_RUNTIME_API_BASE_URL: `${GATEWAY_URL}/api`,
    INTERNAL_GATEWAY_URL: GATEWAY_URL
  };
  const frontendArgs = mode === "prod"
    ? ["exec", "next", "start", "-p", String(FRONTEND_PORT), "-H", "127.0.0.1"]
    : ["exec", "next", "dev", "--turbo", "-p", String(FRONTEND_PORT), "-H", "127.0.0.1"];
  spawnManaged("frontend", "pnpm", frontendArgs, { cwd: FRONTEND_DIR, env: frontendEnv });
  console.log(`KWorks Node stack is running:
  Gateway:  ${GATEWAY_URL}
  Frontend: http://127.0.0.1:${FRONTEND_PORT}
  Model:    ${qiongqiLaunchConfig.model ?? "(not configured)"} (${qiongqiLaunchConfig.source})
  Logs:     ${LOG_DIR}`);
}

function gatewayDataDir() {
  return process.env.QIONGQI_DATA_DIR ?? userWorkspaceDir(defaultWorkspaceRoot("web"), RUNTIME_BOOTSTRAP_USER_ID);
}

function defaultWorkspaceRoot(target) {
  if (process.env.KWORKS_WORKSPACE_DIR) return process.env.KWORKS_WORKSPACE_DIR;
  const home = process.env.HOME || process.env.USERPROFILE;
  const name = target === "web" ? ".kworks-workspace-web" : ".kworks-workspace";
  return home ? join(home, name) : join(REPO_ROOT, name);
}

function userWorkspaceDir(root, userId) {
  return join(root, "users", sanitizeUserId(userId));
}

function sanitizeUserId(userId) {
  const cleaned = String(userId).trim().replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+$/, "_");
  return cleaned || "default";
}

function stop() {
  stopping = true;
  stopByPid("frontend");
  stopByPid("gateway");
  console.log("KWorks Node stack stopped.");
}

function status() {
  for (const name of ["gateway", "frontend"]) {
    const pid = readPid(name);
    console.log(`${name}: ${pid && isAlive(pid) ? `running pid=${pid}` : "stopped"}`);
  }
}

process.on("SIGINT", () => {
  stop();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(143);
});

const [command = "start", arg = "dev"] = process.argv.slice(2);
try {
  if (command === "start") await start(arg === "prod" ? "prod" : "dev");
  else if (command === "stop") stop();
  else if (command === "status") status();
  else {
    usage();
    process.exit(command === "help" || command === "--help" ? 0 : 1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
