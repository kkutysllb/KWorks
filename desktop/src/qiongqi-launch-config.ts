export interface KWorksModelConfig {
  name: string;
  model: string;
  displayName?: string;
  baseUrl: string;
  apiKey: string;
  contextWindowTokens?: number;
  supportsVision?: boolean;
  supportsThinking?: boolean;
}

export interface QiongqiLaunchConfig {
  model?: string;
  baseUrl: string;
  apiKey: string;
  source: "environment" | "default";
  models: KWorksModelConfig[];
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DESKTOP_WORKSPACE_DIR = ".kworks-workspace";
const WEB_WORKSPACE_DIR = ".kworks-workspace-web";

export function resolveQiongqiLaunchConfig(options: {
  env: NodeJS.ProcessEnv;
}): QiongqiLaunchConfig {
  const envModel = firstNonEmpty(options.env.QIONGQI_MODEL, options.env.DEEPSEEK_MODEL);
  const envBaseUrl = firstNonEmpty(options.env.QIONGQI_BASE_URL, options.env.DEEPSEEK_BASE_URL);
  const envApiKey = firstNonEmpty(options.env.QIONGQI_API_KEY, options.env.DEEPSEEK_API_KEY);
  if (envApiKey) {
    return {
      ...(envModel ? { model: envModel } : {}),
      baseUrl: envBaseUrl ?? DEFAULT_BASE_URL,
      apiKey: envApiKey,
      source: "environment",
      models: [],
    };
  }

  return {
    ...(envModel ? { model: envModel } : {}),
    baseUrl: envBaseUrl ?? DEFAULT_BASE_URL,
    apiKey: "",
    source: "default",
    models: [],
  };
}

export function qiongqiConfigFromLaunchConfig(config: QiongqiLaunchConfig): Record<string, unknown> {
  const profiles: Record<string, Record<string, unknown>> = {};
  for (const model of config.models) {
    if (!model.name && !model.model) continue;
    const profileKey = model.name || model.model;
    profiles[profileKey] = {
      aliases: Array.from(new Set([model.model, model.name].filter(Boolean))),
      providerModel: model.model,
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
      ...(model.contextWindowTokens ? { contextWindowTokens: model.contextWindowTokens } : {}),
      ...(model.supportsVision ? { inputModalities: ["text", "image"] } : {}),
      supportsToolCalling: true,
    };
  }
  return {
    serve: {
      ...(config.model ? { model: config.model } : {}),
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    },
    models: { profiles },
  };
}

export function qiongqiStorageBackend(env: NodeJS.ProcessEnv): "file" | "hybrid" {
  return env.QIONGQI_STORAGE_BACKEND === "hybrid" ? "hybrid" : "file";
}

export type KWorksWorkspaceTarget = "desktop" | "web";

export interface KWorksUserWorkspacePaths {
  root: string;
  userRoot: string;
  data: string;
  thread: string;
  threads: string;
  workspace: string;
  memory: string;
  secrets: string;
  usage: string;
  skills: string;
  mcp: string;
  tools: string;
  automations: string;
  artifacts: string;
  attachments: string;
  logs: string;
}

export function defaultKWorksWorkspaceDataDir(
  env: Pick<NodeJS.ProcessEnv, "HOME" | "USERPROFILE"> | NodeJS.ProcessEnv,
  target: KWorksWorkspaceTarget,
): string {
  const home = env.HOME || env.USERPROFILE;
  if (!home) return target === "web" ? WEB_WORKSPACE_DIR : DESKTOP_WORKSPACE_DIR;
  return `${home}/${target === "web" ? WEB_WORKSPACE_DIR : DESKTOP_WORKSPACE_DIR}`;
}

export function resolveKWorksWorkspaceRoot(
  env: NodeJS.ProcessEnv,
  target: KWorksWorkspaceTarget,
): string {
  return firstNonEmpty(
    env.KWORKS_WORKSPACE_DIR,
    env.QIONGQI_DATA_DIR,
    defaultKWorksWorkspaceDataDir(env, target),
  )!;
}

export function kworksUserWorkspacePaths(root: string, userId: string): KWorksUserWorkspacePaths {
  const safeUserId = sanitizeUserId(userId);
  const userRoot = `${root.replace(/\/+$/, "")}/users/${safeUserId}`;
  return {
    root,
    userRoot,
    data: `${userRoot}/data`,
    thread: `${userRoot}/thread`,
    threads: `${userRoot}/threads`,
    workspace: `${userRoot}/workspace`,
    memory: `${userRoot}/memory`,
    secrets: `${userRoot}/secrets`,
    usage: `${userRoot}/usage`,
    skills: `${userRoot}/skills`,
    mcp: `${userRoot}/mcp`,
    tools: `${userRoot}/tools`,
    automations: `${userRoot}/automations`,
    artifacts: `${userRoot}/artifacts`,
    attachments: `${userRoot}/attachments`,
    logs: `${userRoot}/logs`,
  };
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim().length > 0);
}

function sanitizeUserId(userId: string): string {
  const cleaned = userId.trim().replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+$/, "_");
  return cleaned || "default";
}
