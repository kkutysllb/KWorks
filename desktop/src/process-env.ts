import { spawnSync } from "node:child_process";
import { delimiter } from "node:path";

export type StringEnv = Record<string, string>;

export const FINANCE_CREDENTIAL_ENV_KEYS = [
  "IWENCAI_API_KEY",
  "TUSHARE_TOKEN",
] as const;

const LOGIN_SHELL_ENV_START = "KWORKS_ENV_START";
const LOGIN_SHELL_ENV_END = "KWORKS_ENV_END";
const LOGIN_SHELL_ENV_TIMEOUT_MS = 3000;
let cachedFinanceCredentialEnv: StringEnv | null = null;

export const DEFAULT_EXECUTABLE_PATH_ENTRIES =
  process.platform === "win32"
    ? []
    : [
        "$HOME/.local/bin",
        "$HOME/.cargo/bin",
        "$HOME/.npm-global/bin",
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/local/sbin",
        "/opt/local/bin",
        "/opt/local/sbin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
      ];

export function buildChildProcessEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  overrides: NodeJS.ProcessEnv = {},
): StringEnv {
  const env: StringEnv = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value === "string") env[key] = value;
  }
  supplementFinanceCredentialEnv(env, baseEnv);
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "string") env[key] = value;
  }

  const pathKey = resolvePathKey(env);
  env[pathKey] = mergePathEntries([
    env.KWORKS_EXECUTABLE_PATH,
    env[pathKey],
    ...DEFAULT_EXECUTABLE_PATH_ENTRIES.map((entry) =>
      expandPathEntry(entry, env),
    ),
  ]);

  return env;
}

export function mergePathEntries(values: Array<string | undefined>): string {
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const value of values) {
    if (!value) continue;
    for (const entry of value.split(delimiter)) {
      const trimmed = entry.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      entries.push(trimmed);
    }
  }
  return entries.join(delimiter);
}

function resolvePathKey(env: StringEnv): string {
  if (process.platform !== "win32") return "PATH";
  return Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "Path";
}

function expandPathEntry(entry: string, env: StringEnv): string {
  const home = env.HOME || env.USERPROFILE || "";
  return entry.replaceAll("$HOME", home);
}

function supplementFinanceCredentialEnv(
  env: StringEnv,
  baseEnv: NodeJS.ProcessEnv,
): void {
  if (FINANCE_CREDENTIAL_ENV_KEYS.every((key) => hasValue(env[key]))) return;

  const shellEnv = readFinanceCredentialEnvFromLoginShell(baseEnv);
  for (const key of FINANCE_CREDENTIAL_ENV_KEYS) {
    if (!hasValue(env[key]) && hasValue(shellEnv[key])) {
      env[key] = shellEnv[key];
    }
  }
}

export function readFinanceCredentialEnvFromLoginShell(
  baseEnv: NodeJS.ProcessEnv = process.env,
): StringEnv {
  if (process.platform !== "darwin") return {};
  if (cachedFinanceCredentialEnv) return { ...cachedFinanceCredentialEnv };

  // Packaged macOS apps launched from Finder/Dock do not inherit terminal env.
  const shell =
    typeof baseEnv.SHELL === "string" && baseEnv.SHELL.trim()
      ? baseEnv.SHELL
      : "/bin/zsh";
  const script = [
    `printf '%s\\0' ${LOGIN_SHELL_ENV_START}`,
    `for name in ${FINANCE_CREDENTIAL_ENV_KEYS.join(" ")}; do`,
    `value=$(printenv "$name" 2>/dev/null || true)`,
    `if [ -n "$value" ]; then printf '%s=%s\\0' "$name" "$value"; fi`,
    `done`,
    `printf '%s\\0' ${LOGIN_SHELL_ENV_END}`,
  ].join("; ");

  const result = spawnSync(shell, ["-lic", script], {
    env: toStringEnv(baseEnv),
    encoding: "utf8",
    timeout: LOGIN_SHELL_ENV_TIMEOUT_MS,
    windowsHide: true,
  });

  if (result.error || result.status !== 0 || typeof result.stdout !== "string") {
    cachedFinanceCredentialEnv = {};
    return {};
  }

  cachedFinanceCredentialEnv = parseFinanceCredentialEnv(result.stdout);
  return { ...cachedFinanceCredentialEnv };
}

function parseFinanceCredentialEnv(stdout: string): StringEnv {
  const startMarker = `${LOGIN_SHELL_ENV_START}\0`;
  const endMarker = `${LOGIN_SHELL_ENV_END}\0`;
  const start = stdout.indexOf(startMarker);
  if (start < 0) return {};

  const bodyStart = start + startMarker.length;
  const rest = stdout.slice(bodyStart);
  const end = rest.indexOf(endMarker);
  const body = end >= 0 ? rest.slice(0, end) : rest;
  const allowedKeys = new Set<string>(FINANCE_CREDENTIAL_ENV_KEYS);
  const env: StringEnv = {};

  for (const entry of body.split("\0")) {
    if (!entry) continue;
    const separator = entry.indexOf("=");
    if (separator <= 0) continue;
    const key = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (allowedKeys.has(key) && hasValue(value)) {
      env[key] = value;
    }
  }
  return env;
}

function toStringEnv(env: NodeJS.ProcessEnv): StringEnv {
  const stringEnv: StringEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") stringEnv[key] = value;
  }
  return stringEnv;
}

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
