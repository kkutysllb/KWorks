/**
 * Path resolution for the Electron desktop shell.
 *
 * Handles the difference between development (running from source) and
 * packaged (ASAR / unpacked resources) layouts. All path computation is
 * centralized here so the rest of the main process never branches on
 * `app.isPackaged`.
 */

import { app } from "electron";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * The repo root when running in development.
 *
 * `app.getAppPath()` returns the directory containing `package.json`,
 * i.e. `desktop/` itself. The repo root is one level above.
 *
 * (Previously this used `"..", ".."` which incorrectly pointed two
 * levels above the package dir — e.g. `kk_Projects/` instead of
 * `KWorks/` — causing dev-mode icon/resource resolution to silently
 * fail because every candidate path was off by one directory.)
 */
const REPO_ROOT = resolve(app.getAppPath(), "..");

/** Whether we are running from a packaged app (not from source). */
export function isPackaged(): boolean {
  return app.isPackaged;
}

/**
 * The embedded-frontend directory served by `BrowserWindow.loadFile`.
 *
 * - Packaged: `<resourcesPath>/frontend-out` (shipped via electron-builder
 *   `extraResources`)
 * - Development: `frontend/out` in the repo (built by `desktop-build.mjs`)
 */
export function getFrontendDistDir(): string {
  if (isPackaged()) {
    return join(process.resourcesPath, "frontend-out");
  }
  return join(REPO_ROOT, "frontend", "out");
}

/**
 * The app's writable data directory.
 *
 * Desktop and packaged builds store runtime data under `~/.kworks-workspace`.
 * Web/dev deployments use `~/.kworks-workspace-web`, keeping the two products
 * isolated while preserving the same per-user workspace layout.
 */
export function getAppDataDir(): string {
  return join(homedir(), ".kworks-workspace");
}

/** Directory used for extracted packaged runtimes and other generated assets. */
export function getRuntimeCacheDir(): string {
  return join(getAppDataDir(), "runtime");
}

/**
 * The gateway state directory (`KWorks_HOME`).
 *
 * On desktop this is the same as `getAppDataDir()` (`~/.kworks-workspace`).
 */
export function getKworksHome(): string {
  return getAppDataDir();
}

/**
 * The Coding Agent's dedicated home directory.
 *
 * Desktop uses `~/.kworks-coding-desktop` (suffixed to stay isolated from the
 * web deployment's `~/.kworks-coding`). This is injected into the Node runtime
 * as `KWorks_CODING_HOME`.
 */
export function getCodingHome(): string {
  return join(homedir(), ".kworks-coding-desktop");
}

/**
 * Path to the persisted JWT signing secret.
 *
 * The desktop gateway must use a STABLE secret across restarts — otherwise
 * every app relaunch generates a new ephemeral ``AUTH_JWT_SECRET`` and
 * invalidates all existing JWTs, causing 401s on every API call until the
 * user re-logs in.
 */
export function getAuthJwtSecretPath(): string {
  return join(getKworksHome(), ".auth_jwt_secret");
}

/** The logs directory for gateway stdout/stderr. */
export function getLogsDir(): string {
  return join(getAppDataDir(), "logs");
}

/** The gateway log file path. */
export function getGatewayLogPath(): string {
  return join(getLogsDir(), "gateway.log");
}

/** The Electron main-process log file path. */
export function getMainLogPath(): string {
  return join(getLogsDir(), "main.log");
}

/** The renderer-process console log file path. */
export function getRendererLogPath(): string {
  return join(getLogsDir(), "renderer.log");
}

/**
 * The user-writable skills root.
 *
 * `~/.kworks-workspace/skills/` contains unified built-in skill buckets and
 * writable custom skill buckets:
 * - builtin/core
 * - builtin/task
 * - builtin/coding
 * - custom/shared
 */
export function getSkillsDir(): string {
  return join(getAppDataDir(), "skills");
}

export function getBuiltinCoreSkillsDir(): string {
  return join(getSkillsDir(), "builtin", "core");
}

export function getBuiltinTaskSkillsDir(): string {
  return join(getSkillsDir(), "builtin", "task");
}

export function getBuiltinCodingSkillsDir(): string {
  return join(getSkillsDir(), "builtin", "coding");
}

export function getCustomSharedSkillsDir(): string {
  return join(getSkillsDir(), "custom", "shared");
}

export function getSkillsMigrationMarkerPath(): string {
  return join(getSkillsDir(), ".migration-v2.json");
}

/**
 * The QiongQi runtime source bundled with KWorks.
 *
 * Development uses the vendored source under the repository. Packaged builds
 * use the bundled archive and extract it into the writable runtime cache. The
 * direct `extraResources/qiongqi` directory is only a legacy fallback for older
 * packages.
 */
export function getQiongqiRuntimeDir(): string {
  if (isPackaged()) {
    return existsSync(getBundledQiongqiRuntimeArchivePath())
      ? join(getRuntimeCacheDir(), "qiongqi")
      : getPackagedQiongqiRuntimeDir();
  }
  return join(REPO_ROOT, "qiongqi");
}

/** The direct packaged QiongQi runtime directory used by Windows/Linux builds. */
export function getPackagedQiongqiRuntimeDir(): string {
  return join(process.resourcesPath, "qiongqi");
}

/** The compressed QiongQi runtime shipped as a package resource. */
export function getBundledQiongqiRuntimeArchivePath(): string {
  return join(process.resourcesPath, "qiongqi-runtime.tar.gz");
}

/**
 * The persisted file remembering user-granted external paths.
 *
 * When an agent tries to read/write outside the default allowed roots
 * (`~/.kworks-workspace`, `~/.kworks-coding-desktop`, project roots, system
 * temp), the desktop shows a system authorization dialog. Accepted paths are
 * appended here so subsequent access is silent (prefix-matched). File mode is
 * 0600 — only the current user may read/modify the grant list.
 */
export function getGrantedPathsPath(): string {
  return join(getAppDataDir(), "granted_paths.json");
}

/**
 * The bundled skills source directory (read-only).
 *
 * - Packaged: electron-builder ships skills under `resources/skills`.
 * - Development: the repo `skills/` directory.
 *
 * Returns `null` when no bundled source is present (e.g. dev without repo).
 */
export function getBundledSkillsDir(): string | null {
  if (isPackaged()) {
    const packagedSkills = join(process.resourcesPath, "skills");
    return existsSync(join(packagedSkills, "public")) ||
      existsSync(join(packagedSkills, "builtin"))
      ? packagedSkills
      : null;
  }
  // Development: repo skills directory.
  const devSkills = join(REPO_ROOT, "skills");
  return existsSync(devSkills) ? devSkills : null;
}

export { REPO_ROOT };
