import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type { MCPServerConfig, MCPConfig, MCPRuntimeDiagnostics } from "./types";

export async function loadMCPConfig(): Promise<MCPConfig> {
  const response = await fetch(`${getBackendBaseURL()}/api/mcp/config`);
  const config = (await response.json()) as MCPConfig;
  return normalizeMCPConfig(config);
}

export async function loadMCPRuntimeDiagnostics(): Promise<MCPRuntimeDiagnostics> {
  const response = await fetch(`${getBackendBaseURL()}/v1/runtime/tools`);
  if (!response.ok) {
    throw new Error(`Failed to load MCP runtime diagnostics (${response.status})`);
  }
  const diagnostics = (await response.json()) as Partial<MCPRuntimeDiagnostics>;
  return { mcpServers: diagnostics.mcpServers ?? [] };
}

export async function updateMCPConfig(config: MCPConfig) {
  const normalized = normalizeMCPConfig(config);
  const response = await fetch(`${getBackendBaseURL()}/api/mcp/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalized),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(
      (detail as { detail?: string }).detail ??
        `Failed to update MCP config (${response.status})`,
    );
  }
  return normalizeMCPConfig((await response.json()) as MCPConfig);
}

export async function addMCPServer(
  name: string,
  serverConfig: MCPServerConfig,
): Promise<MCPConfig> {
  const current = await loadMCPConfig();
  const updated: MCPConfig = {
    mcp_servers: {
      ...current.mcp_servers,
      [name]: serverConfig,
    },
  };
  return updateMCPConfig(updated);
}

export function normalizeMCPConfig(config: MCPConfig): MCPConfig {
  return {
    mcp_servers: Object.fromEntries(
      Object.entries(config.mcp_servers ?? {}).map(([name, server]) => [
        name,
        normalizeMCPServerConfig(server),
      ]),
    ),
  };
}

export function normalizeMCPServerConfig(
  server: MCPServerConfig,
): MCPServerConfig {
  const legacyType =
    typeof server.type === "string" ? server.type : undefined;
  const transport = normalizeTransport(
    typeof server.transport === "string" ? server.transport : legacyType,
  );
  const normalized: MCPServerConfig = {
    enabled: server.enabled ?? true,
    transport,
    args: Array.isArray(server.args)
      ? server.args.filter((item): item is string => typeof item === "string")
      : [],
    env: stringRecord(server.env),
    headers: stringRecord(server.headers),
    trustScope: server.trustScope === "user" ? "user" : "workspace",
    trustedWorkspaceRoots: Array.isArray(server.trustedWorkspaceRoots)
      ? server.trustedWorkspaceRoots.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [],
    timeoutMs:
      typeof server.timeoutMs === "number" && server.timeoutMs > 0
        ? Math.round(server.timeoutMs)
        : 30_000,
  };
  if (transport === "stdio") {
    normalized.command =
      typeof server.command === "string" ? server.command : "npx";
  } else if (typeof server.url === "string") {
    normalized.url = server.url;
  }
  return normalized;
}

function normalizeTransport(value: string | undefined): "stdio" | "sse" | "streamable-http" {
  if (value === "sse") return "sse";
  if (value === "streamable-http" || value === "http") {
    return "streamable-http";
  }
  return "stdio";
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") out[key] = item;
  }
  return out;
}

export async function deleteMCPServer(name: string): Promise<MCPConfig> {
  const current = await loadMCPConfig();
  const servers = { ...current.mcp_servers };
  delete servers[name];
  const updated: MCPConfig = { mcp_servers: servers };
  return updateMCPConfig(updated);
}
