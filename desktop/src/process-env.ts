import { delimiter } from "node:path";

export type StringEnv = Record<string, string>;

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
