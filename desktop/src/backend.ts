/**
 * Node gateway lifecycle management for the Electron desktop shell.
 *
 * Ported from the previous Rust implementation (`desktop/src-tauri/src/backend.rs`).
 * Responsibilities:
 *  - Resolve the gateway launch command (bundled QiongQi runtime → vendored dev runtime)
 *  - Spawn the child process with an isolated environment
 *  - Poll `/health` until the gateway responds (or times out)
 *  - Capture stdout/stderr into a rotating in-memory log buffer + log file
 *  - Kill the child cleanly on shutdown (SIGTERM → SIGKILL)
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  cpSync,
  createWriteStream,
  existsSync,
  rmSync,
  statSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  type WriteStream,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

import {
  getAuthJwtSecretPath,
  getBundledQiongqiRuntimeArchivePath,
  getBuiltinCodingSkillsDir,
  getBuiltinCoreSkillsDir,
  getBuiltinFinanceSkillsDir,
  getBuiltinTaskSkillsDir,
  getBundledSkillsDir,
  getCodingHome,
  getCustomSharedSkillsDir,
  getGatewayLogPath,
  getKworksHome,
  getLogsDir,
  getQiongqiRuntimeDir,
  getRuntimeCacheDir,
  getSkillsDir,
  getSkillsMigrationMarkerPath,
  isPackaged,
  REPO_ROOT,
} from "./paths.js";
import {
  kworksUserWorkspacePaths,
  qiongqiConfigFromLaunchConfig,
  qiongqiStorageBackend,
  resolveKWorksWorkspaceRoot,
  resolveQiongqiLaunchConfig,
} from "./qiongqi-launch-config.js";
import { buildChildProcessEnv } from "./process-env.js";

// ── Constants ────────────────────────────────────────────────────────────

/** Default gateway port (distinct from the web deployment's 9987). */
export const DEFAULT_GATEWAY_PORT = 19987;
/** Gateway host — always localhost, never exposed externally. */
const GATEWAY_HOST = "127.0.0.1";
/** Health-probe interval in milliseconds. */
const HEALTH_CHECK_INTERVAL_MS = 500;
/** Health-probe timeout in seconds. */
const HEALTH_CHECK_TIMEOUT_SECS = 120;
/** Maximum log lines retained in memory. */
const MAX_LOG_LINES = 500;
const RUNTIME_BOOTSTRAP_USER_ID = "runtime";

export type BackendStatusKind = "stopped" | "starting" | "running" | "error";

export interface BackendStatus {
  status: BackendStatusKind;
  port: number;
  error?: string;
}

// ── Gateway port resolution ──────────────────────────────────────────────

/**
 * Resolve the gateway port. Prefers a `GATEWAY_PORT` env override (useful for
 * running multiple instances), otherwise falls back to the default.
 */
export function resolveGatewayPort(): number {
  const fromEnv = Number.parseInt(process.env.GATEWAY_PORT ?? "", 10);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_GATEWAY_PORT;
}

// ── BackendManager ───────────────────────────────────────────────────────

type StatusListener = (status: BackendStatus) => void;

/**
 * Manages a single embedded Node gateway process.
 *
 * State transitions: stopped → starting → running | error → stopped.
 * The manager is a singleton held by the main process; the renderer polls
 * status via IPC.
 */
export class BackendManager extends EventEmitter {
  private child: ChildProcess | null = null;
  private status: BackendStatus = {
    status: "stopped",
    port: resolveGatewayPort(),
  };
  private logs: string[] = [];
  private logStream: WriteStream | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private healthStartTime = 0;

  /** Subscribe to status changes. Returns an unsubscribe function. */
  onStatusChange(listener: StatusListener): () => void {
    this.on("status", listener);
    return () => this.off("status", listener);
  }

  /** Current backend status snapshot. */
  getStatus(): BackendStatus {
    return { ...this.status };
  }

  /** Recent log lines (most recent last). */
  getLogs(): string[] {
    return [...this.logs];
  }

  // ── Launch ────────────────────────────────────────────────────────────

  /**
   * Launch the gateway as the desktop-owned child process.
   */
  async launch(): Promise<BackendStatus> {
    if (this.child || this.status.status === "starting") {
      return this.getStatus();
    }

    const port = resolveGatewayPort();

    this.openLogStream();

    try {
      this.ensureDataDirs();
      this.ensurePackagedQiongqiRuntime();
      this.initSkills();
      this.ensureQiongqiRuntimeBuildFresh();
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.appendLog(`[backend] ${err}`);
      await this.closeLogStream();
      this.setStatus({ status: "error", port, error: err });
      return this.getStatus();
    }

    const cmd = this.resolveCommand(port);
    if (!cmd) {
      const err = "No built Node QiongQi runtime found.";
      this.appendLog(`[backend] ${err}`);
      await this.closeLogStream();
      this.setStatus({ status: "error", port, error: err });
      return this.getStatus();
    }

    this.appendLog(`[backend] launching: ${cmd.command} ${cmd.args.join(" ")}`);
    this.setStatus({ status: "starting", port });

    try {
      this.child = spawn(cmd.command, cmd.args, {
        env: this.buildEnv(port),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.appendLog(`[backend] spawn failed: ${msg}`);
      await this.closeLogStream();
      this.setStatus({ status: "error", port, error: msg });
      return this.getStatus();
    }

    this.wireProcessIO();
    this.child.once("exit", (code, signal) => {
      this.appendLog(
        `[backend] process exited (code=${code}, signal=${signal})`,
      );
      if (this.status.status !== "error" && this.status.status !== "stopped") {
        this.setStatus({ status: "stopped", port });
      }
      this.child = null;
      this.stopHealthMonitor();
      void this.closeLogStream();
    });

    this.startHealthMonitor(port);
    return this.getStatus();
  }

  /** Stop the gateway process. */
  async stop(): Promise<BackendStatus> {
    this.stopHealthMonitor();
    const port = resolveGatewayPort();
    if (!this.child) {
      await this.closeLogStream();
      this.setStatus({ status: "stopped", port });
      return this.getStatus();
    }
    try {
      await this.killProcess(this.child);
    } finally {
      this.child = null;
      await this.closeLogStream();
    }
    this.setStatus({ status: "stopped", port });
    return this.getStatus();
  }

  /** Restart: stop, wait, then launch. */
  async restart(): Promise<BackendStatus> {
    await this.stop();
    await new Promise((r) => setTimeout(r, 1000));
    return this.launch();
  }

  // ── Command resolution ────────────────────────────────────────────────

  private resolveCommand(port: number): {
    command: string;
    args: string[];
  } | null {
    const runtimeDir = getQiongqiRuntimeDir();
    const entry = resolveQiongqiServeEntry(runtimeDir);
    if (!existsSync(entry)) return null;

    const qiongqiLaunchConfig = resolveQiongqiLaunchConfig({
      env: process.env,
    });
    const qiongqiConfigPath = this.writeQiongqiLaunchConfig(qiongqiLaunchConfig);
    const storageBackend = qiongqiStorageBackend(process.env);
    const qiongqiDataDir = kworksUserWorkspacePaths(
      resolveKWorksWorkspaceRoot(process.env, "desktop"),
      RUNTIME_BOOTSTRAP_USER_ID,
    ).userRoot;
    return {
      command: process.execPath,
      args: [
        entry,
        "serve",
        "--config",
        qiongqiConfigPath,
        "--preset",
        "coding",
        "--host",
        GATEWAY_HOST,
        "--port",
        String(port),
        "--data-dir",
        qiongqiDataDir,
        "--storage-backend",
        storageBackend,
        "--insecure",
      ],
    };
  }

  private ensureQiongqiRuntimeBuildFresh(): void {
    if (isPackaged()) return;
    const runtimeDir = getQiongqiRuntimeDir();
    const packages = [
      "packages/adapters/adapter-model",
      "packages/adapters/adapter-storage",
      "packages/http-layer/http",
      "packages/cli-layer/cli",
    ];

    for (const relativePackageDir of packages) {
      const packageDir = join(runtimeDir, relativePackageDir);
      const srcDir = join(packageDir, "src");
      const distDir = join(packageDir, "dist");
      if (!existsSync(srcDir)) continue;
      if (existsSync(distDir) && newestMtimeMs(srcDir) <= oldestMtimeMs(distDir)) continue;

      const tsc = join(packageDir, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
      const command = existsSync(tsc) ? tsc : process.execPath;
      const args = existsSync(tsc)
        ? ["-p", "tsconfig.build.json"]
        : [join(runtimeDir, "node_modules", ".pnpm", "typescript@5.9.3", "node_modules", "typescript", "lib", "tsc.js"), "-p", "tsconfig.build.json"];
      this.appendLog(`[backend] QiongQi dist stale, rebuilding ${relativePackageDir}`);
      const result = spawnSync(command, args, {
        cwd: packageDir,
        encoding: "utf8",
        windowsHide: true,
      });
      if (result.stdout?.trim()) this.appendLog(result.stdout.trim());
      if (result.stderr?.trim()) this.appendLog(result.stderr.trim());
      if (result.status !== 0) {
        throw new Error(`Failed to rebuild ${relativePackageDir} (exit ${result.status ?? "unknown"})`);
      }
    }
  }

  private ensurePackagedQiongqiRuntime(): void {
    if (!isPackaged()) return;

    const archive = getBundledQiongqiRuntimeArchivePath();
    if (!existsSync(archive)) return;

    const runtimeDir = getQiongqiRuntimeDir();
    const markerPath = join(runtimeDir, ".kworks-runtime-archive.json");
    const archiveSha256 = sha256File(archive);
    const entry = resolveQiongqiServeEntry(runtimeDir);
    if (existsSync(entry) && readRuntimeArchiveMarker(markerPath) === archiveSha256) return;

    const cacheDir = getRuntimeCacheDir();
    mkdirSync(cacheDir, { recursive: true });
    rmSync(runtimeDir, { recursive: true, force: true });

    const result = spawnSync("tar", ["-xzf", archive, "-C", cacheDir], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0) {
      const detail = result.stderr?.trim() || result.stdout?.trim() || "unknown tar error";
      throw new Error(`Failed to extract bundled QiongQi runtime: ${detail}`);
    }

    const extractedEntry = resolveQiongqiServeEntry(runtimeDir);
    if (!existsSync(extractedEntry)) {
      throw new Error(
        `Extracted QiongQi runtime is missing serve entry under ${runtimeDir}`,
      );
    }
    writeFileSync(
      markerPath,
      `${JSON.stringify({ archiveSha256, extractedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );
    this.appendLog(`[backend] extracted bundled QiongQi runtime to ${runtimeDir}`);
  }

  // ── Environment ───────────────────────────────────────────────────────

  /**
   * Build the isolated child-process environment.
   *
   * `KWorks_HOME` points at `~/.kworks-workspace` so desktop state lives in
   * the user's home folder (discoverable + backup-friendly) and stays isolated
   * from a co-located web deployment's `~/.kkworks` / `<repo>/.kkworks`.
   *
   * `KWorks_CODING_HOME` points at `~/.kworks-coding-desktop`, the dedicated
   * scratch/session store for coding tasks.
   *
   * `KWorks_SKILLS_PATH` points at `~/.kworks-workspace/skills`; the gateway
   * expands it to builtin/core, builtin/task, builtin/coding, and custom/shared.
   * The custom/shared directory is created empty so users can author their own
   * skills at runtime — we do NOT set
   * `KWorks_PUBLIC_SKILLS_ONLY` because that flag was meant to skip stale
   * custom skills during *bundling*, not to forbid users from creating them.
   *
   * `KWorks_PROJECT_ROOT` is only set in development, where the repo source
   * tree exists.
   */
  private buildEnv(port: number): NodeJS.ProcessEnv {
    const qiongqiLaunchConfig = resolveQiongqiLaunchConfig({
      env: process.env,
    });
    const storageBackend = qiongqiStorageBackend(process.env);
    const kworksWorkspaceRoot = resolveKWorksWorkspaceRoot(process.env, "desktop");
    const runtimeWorkspace = kworksUserWorkspacePaths(kworksWorkspaceRoot, RUNTIME_BOOTSTRAP_USER_ID);

    const env: NodeJS.ProcessEnv = buildChildProcessEnv(process.env, {
      // Isolation: desktop state lives under ~/.kworks-workspace.
      KWorks_HOME: getKworksHome(),
      KWorks_DATA_DIR: join(getKworksHome(), "data"),
      // Coding Agent scratch/session store: ~/.kworks-coding-desktop.
      KWorks_CODING_HOME: getCodingHome(),
      // Skills root: unified built-ins + user-created shared custom skills.
      KWorks_SKILLS_PATH: getSkillsDir(),
      // QiongQi runtime: vendored source in dev, bundled extraResource in packaged builds.
      KWorks_QIONGQI_REPO_PATH: getQiongqiRuntimeDir(),
      // Desktop static export talks to the gateway from the app:// origin.
      GATEWAY_CORS_ORIGINS: "app://-",
      CORS_ORIGINS: "app://-",
      // Keep Node runtime logs co-located with the Electron-captured stdout
      // logs under ~/.kworks-workspace/logs.
      KWorks_LOG_DIR: getLogsDir(),
      // Persisted JWT signing secret — prevents session invalidation on
      // every gateway restart. Without this, the gateway generates a new
      // ephemeral AUTH_JWT_SECRET on each launch and all existing tokens
      // become invalid (causing 401 on /api/models, /api/threads/search, etc).
      AUTH_JWT_SECRET: this.ensureAuthJwtSecret(),
      // Gateway binding.
      GATEWAY_HOST: GATEWAY_HOST,
      GATEWAY_PORT: String(port),
      GATEWAY_LOG_LEVEL: "debug",
      QIONGQI_HOST: GATEWAY_HOST,
      QIONGQI_PORT: String(port),
      KWORKS_WORKSPACE_DIR: kworksWorkspaceRoot,
      QIONGQI_DATA_DIR: runtimeWorkspace.userRoot,
      QIONGQI_STORAGE_BACKEND: storageBackend,
      QIONGQI_API_KEY: qiongqiLaunchConfig.apiKey,
      QIONGQI_BASE_URL: qiongqiLaunchConfig.baseUrl,
      ...(qiongqiLaunchConfig.model ? { QIONGQI_MODEL: qiongqiLaunchConfig.model } : {}),
    });

    if (isPackaged()) {
      env.ELECTRON_RUN_AS_NODE = "1";
    }

    // Only expose the repo source root in development.
    if (!isPackaged()) {
      env.KWorks_PROJECT_ROOT = REPO_ROOT;
    }

    return env;
  }

  // ── Process IO & logging ──────────────────────────────────────────────

  private wireProcessIO(): void {
    const child = this.child;
    if (!child) return;

    const handleStream = (stream: NodeJS.ReadableStream | null) => {
      if (!stream) return;
      let pending = "";
      stream.on("data", (chunk: Buffer) => {
        pending += chunk.toString();
        const lines = pending.split("\n");
        // Keep the last (possibly partial) line in the buffer.
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (line.length > 0) this.appendLog(line);
        }
      });
    };

    handleStream(child.stdout);
    handleStream(child.stderr);
  }

  private appendLog(line: string): void {
    const stamped = `[${new Date().toISOString()}] ${line}`;
    this.logs.push(stamped);
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs.splice(0, this.logs.length - MAX_LOG_LINES);
    }
    this.logStream?.write(stamped + "\n");
  }

  private openLogStream(): void {
    if (this.logStream) return;
    try {
      mkdirSync(getLogsDir(), { recursive: true });
      this.logStream = createWriteStream(getGatewayLogPath(), {
        flags: "a",
      });
    } catch (e) {
      console.error("[backend] failed to open log stream:", e);
    }
  }

  private async closeLogStream(): Promise<void> {
    const stream = this.logStream;
    if (!stream) return;
    this.logStream = null;
    await new Promise<void>((resolveFn) => {
      stream.end(resolveFn);
    });
  }

  // ── Health monitoring ─────────────────────────────────────────────────

  private startHealthMonitor(port: number): void {
    this.stopHealthMonitor();
    this.healthStartTime = Date.now();
    this.healthTimer = setInterval(() => {
      void this.healthTick(port);
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthMonitor(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private async healthTick(port: number): Promise<void> {
    const elapsed = (Date.now() - this.healthStartTime) / 1000;
    if (elapsed > HEALTH_CHECK_TIMEOUT_SECS) {
      this.stopHealthMonitor();
      const err = `Backend failed to start within ${HEALTH_CHECK_TIMEOUT_SECS}s`;
      this.appendLog(`[backend] ${err}`);
      this.setStatus({ status: "error", port, error: err });
      await this.killCurrent();
      return;
    }

    try {
      const ok = await this.checkGatewayReady(port);
      if (ok && this.status.status === "starting") {
        this.appendLog("[backend] gateway readiness check passed — gateway is up");
        this.stopHealthMonitor();
        this.setStatus({ status: "running", port });
      }
    } catch {
      // Not up yet — keep polling until timeout.
    }
  }

  /** Probe health plus required KWorks compatibility routes. */
  private async checkGatewayReady(port: number): Promise<boolean> {
    try {
      const health = await fetch(`http://${GATEWAY_HOST}:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!health.ok) return false;

      const crons = await fetch(`http://${GATEWAY_HOST}:${port}/api/crons`, {
        signal: AbortSignal.timeout(2000),
      });
      if (crons.status === 404) {
        throw new Error(
          "compatibility route /api/crons returned 404; bundled QiongQi runtime is stale",
        );
      }
      return crons.ok;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("compatibility route /api/crons returned 404")
      ) {
        this.appendLog(`[backend] ${error.message}`);
      }
      return false;
    }
  }

  // ── Process teardown ──────────────────────────────────────────────────

  private async killCurrent(): Promise<void> {
    if (!this.child) return;
    await this.killProcess(this.child);
    this.child = null;
  }

  /** Kill a child process: graceful SIGTERM, then forceful SIGKILL. */
  private async killProcess(child: ChildProcess): Promise<void> {
    if (!child.pid) return;

    if (platform() === "win32") {
      // Windows: taskkill the process tree (SIGTERM isn't supported).
      try {
        const taskkill = spawn("taskkill", [
          "/pid",
          String(child.pid),
          "/f",
          "/t",
        ]);
        await new Promise<void>((resolveFn) => {
          const timeout = setTimeout(() => {
            taskkill.kill();
            resolveFn();
          }, 2000);

          taskkill.once("exit", () => {
            clearTimeout(timeout);
            resolveFn();
          });
          taskkill.once("error", () => {
            clearTimeout(timeout);
            resolveFn();
          });
        });
      } catch {
        /* ignore */
      }
      return;
    }

    // Unix: SIGTERM first, escalate to SIGKILL after a grace period.
    try {
      process.kill(child.pid, "SIGTERM");
    } catch {
      /* already dead */
    }

    await new Promise<void>((resolveFn) => {
      const grace = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
        resolveFn();
      }, 500);

      child.once("exit", () => {
        clearTimeout(grace);
        resolveFn();
      });
    });
  }

  // ── Data dir bootstrap ────────────────────────────────────────────────

  private ensureDataDirs(): void {
    const home = getKworksHome();
    const subdirs = ["", "logs"];
    for (const sub of subdirs) {
      const dir = join(home, sub);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
    // Coding Agent home must exist so its session/skill stores can write into
    // it on first use. Created here (not in Python) to match the pattern of
    // the main home dir above.
    const codingHome = getCodingHome();
    if (!existsSync(codingHome)) mkdirSync(codingHome, { recursive: true });
  }

  private writeQiongqiLaunchConfig(qiongqiLaunchConfig: ReturnType<typeof resolveQiongqiLaunchConfig>): string {
    const configPath = join(getKworksHome(), "qiongqi-config.json");
    try {
      writeFileSync(
        configPath,
        `${JSON.stringify(qiongqiConfigFromLaunchConfig(qiongqiLaunchConfig), null, 2)}\n`,
        { encoding: "utf8", mode: 0o600 },
      );
      this.appendLog(`[backend] wrote QiongQi launch config (${qiongqiLaunchConfig.source})`);
    } catch (e) {
      this.appendLog(
        `[backend] failed to write QiongQi launch config: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return configPath;
  }

  /**
   * Load or create a persistent JWT signing secret.
   *
   * The secret is stored in ``<KWorks_HOME>/.auth_jwt_secret`` and reused
   * across gateway restarts so that JWTs issued during a previous session
   * remain valid. If the file does not exist (first launch or after cache
   * clear), a new cryptographically random secret is generated and persisted.
   */
  private ensureAuthJwtSecret(): string {
    const secretPath = getAuthJwtSecretPath();

    // Try reading the existing secret.
    if (existsSync(secretPath)) {
      try {
        const existing = readFileSync(secretPath, "utf8").trim();
        if (existing.length >= 32) return existing;
      } catch {
        // Corrupt or unreadable — fall through to regenerate.
      }
    }

    // Generate a new secret and persist it.
    const secret = randomBytes(32).toString("base64url");
    try {
      mkdirSync(join(secretPath, ".."), { recursive: true });
      writeFileSync(secretPath, secret, "utf8");
      this.appendLog("[backend] generated and persisted AUTH_JWT_SECRET");
    } catch (e) {
      this.appendLog(
        `[backend] WARNING: failed to persist AUTH_JWT_SECRET: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return secret;
  }

  /**
   * Seed the user-writable skills directory into unified skill roots.
   *
   * On first run, copies bundled public and coding skills into
   * builtin/core, builtin/task, and builtin/coding. It also creates
   * custom/shared for user-authored skills. Subsequent runs only copy missing
   * skills and never overwrite local edits.
   */
  private initSkills(): void {
    const bundled = getBundledSkillsDir();
    const skillsRoot = getSkillsDir();
    const coreTarget = getBuiltinCoreSkillsDir();
    const taskTarget = getBuiltinTaskSkillsDir();
    const codingTarget = getBuiltinCodingSkillsDir();
    const financeTarget = getBuiltinFinanceSkillsDir();
    const customSharedTarget = getCustomSharedSkillsDir();

    for (const dir of [coreTarget, taskTarget, codingTarget, financeTarget, customSharedTarget]) {
      mkdirSync(dir, { recursive: true });
    }
    this.migrateLegacySkillRoots(skillsRoot, { coreTarget, taskTarget, codingTarget, customSharedTarget });

    if (!bundled) {
      this.appendLog("[backend] no bundled skills source found");
      return;
    }

    let copied = 0;

    const bundledBuiltin = join(bundled, "builtin");
    if (existsSync(bundledBuiltin)) {
      copied += this.copyMissingChildren(join(bundledBuiltin, "core"), coreTarget);
      copied += this.copyMissingChildren(join(bundledBuiltin, "task"), taskTarget);
      copied += this.copyMissingChildren(join(bundledBuiltin, "coding"), codingTarget);
      copied += this.copyMissingChildren(join(bundledBuiltin, "finance"), financeTarget);
    }

    const bundledPublic = join(bundled, "public");
    if (existsSync(bundledPublic)) {
      for (const name of readdirSync(bundledPublic)) {
        const src = join(bundledPublic, name);
        if (!statSync(src).isDirectory()) continue;
        if (name === "coding") {
          copied += this.copyMissingChildren(src, codingTarget);
          continue;
        }
        if (name === "finance") {
          copied += this.copyMissingChildren(src, financeTarget);
          continue;
        }
        const target = join(this.targetForPublicSkill(name, {
          coreTarget,
          taskTarget,
          codingTarget,
        }), name);
        copied += this.copyMissingSkill(src, target, name);
      }
    } else if (!existsSync(bundledBuiltin)) {
      this.appendLog(`[backend] bundled skills source not found under ${bundled}`);
    }

    const qiongqiSkillRoot = join(getQiongqiRuntimeDir(), "skills");
    if (existsSync(qiongqiSkillRoot)) {
      for (const name of readdirSync(qiongqiSkillRoot)) {
        const src = join(qiongqiSkillRoot, name);
        if (!statSync(src).isDirectory()) continue;
        const target = ["goal", "todo", "web"].includes(name) ? coreTarget : codingTarget;
        copied += this.copyMissingSkill(src, join(target, name), name);
      }
    }

    if (copied > 0) {
      this.appendLog(`[backend] synced ${copied} bundled skill(s) into unified roots under ${skillsRoot}`);
    }
  }

  private migrateLegacySkillRoots(
    skillsRoot: string,
    targets: {
      coreTarget: string;
      taskTarget: string;
      codingTarget: string;
      customSharedTarget: string;
    },
  ): void {
    const marker = getSkillsMigrationMarkerPath();
    const legacyPublic = join(skillsRoot, "public");
    const legacyCustom = join(skillsRoot, "custom");
    let copied = 0;

    if (existsSync(legacyPublic)) {
      for (const name of readdirSync(legacyPublic)) {
        const src = join(legacyPublic, name);
        if (!statSync(src).isDirectory()) continue;
        if (name === "coding") {
          copied += this.copyMissingChildren(src, targets.codingTarget);
          continue;
        }
        const target = join(this.targetForPublicSkill(name, targets), name);
        copied += this.copyMissingSkill(src, target, name);
      }
    }

    if (existsSync(legacyCustom)) {
      for (const name of readdirSync(legacyCustom)) {
        if (name === "shared") continue;
        const src = join(legacyCustom, name);
        if (!statSync(src).isDirectory()) continue;
        copied += this.copyMissingSkill(src, join(targets.customSharedTarget, name), name);
      }
    }

    if (copied > 0 || !existsSync(marker)) {
      writeFileSync(marker, JSON.stringify({ version: 2, migratedAt: new Date().toISOString(), copied }, null, 2));
    }
  }

  private targetForPublicSkill(
    name: string,
    targets: { coreTarget: string; taskTarget: string; codingTarget: string },
  ): string {
    if (["bootstrap", "find-skills", "skill-creator", "skill-manage"].includes(name)) return targets.coreTarget;
    return targets.taskTarget;
  }

  private copyMissingChildren(srcParent: string, dstParent: string): number {
    if (!existsSync(srcParent)) return 0;
    let copied = 0;
    for (const name of readdirSync(srcParent)) {
      const src = join(srcParent, name);
      if (!statSync(src).isDirectory()) continue;
      copied += this.copyMissingSkill(src, join(dstParent, name), name);
    }
    return copied;
  }

  private copyMissingSkill(src: string, dst: string, name: string): number {
    if (existsSync(dst)) return 0;
    try {
      cpSync(src, dst, { recursive: true });
      return 1;
    } catch (e) {
      this.appendLog(
        `[backend] failed to copy skill '${name}': ${e instanceof Error ? e.message : String(e)}`,
      );
      return 0;
    }
  }

  // ── Status ────────────────────────────────────────────────────────────

  private setStatus(next: BackendStatus): void {
    this.status = next;
    this.emit("status", this.getStatus());
  }
}

function newestMtimeMs(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const stat = statSync(path);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtimeMs(path));
    } else {
      newest = Math.max(newest, stat.mtimeMs);
    }
  }
  return newest;
}

function oldestMtimeMs(dir: string): number {
  let oldest = Number.POSITIVE_INFINITY;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const stat = statSync(path);
    if (entry.isDirectory()) {
      oldest = Math.min(oldest, oldestMtimeMs(path));
    } else {
      oldest = Math.min(oldest, stat.mtimeMs);
    }
  }
  return Number.isFinite(oldest) ? oldest : 0;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resolveQiongqiServeEntry(runtimeDir: string): string {
  return qiongqiServeEntryCandidates(runtimeDir).find((entry) => existsSync(entry)) ??
    qiongqiServeEntryCandidates(runtimeDir)[0];
}

function qiongqiServeEntryCandidates(runtimeDir: string): string[] {
  return [
    join(runtimeDir, "packages", "cli-layer", "cli", "dist", "serve-entry.js"),
    join(runtimeDir, "dist", "serve-entry.js"),
  ];
}

function readRuntimeArchiveMarker(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as { archiveSha256?: unknown };
    return typeof data.archiveSha256 === "string" ? data.archiveSha256 : null;
  } catch {
    return null;
  }
}
