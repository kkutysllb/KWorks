export type MCPTransport = "stdio" | "sse" | "streamable-http";

export type MCPTrustScope = "workspace" | "user";

export interface MCPServerConfig {
  enabled: boolean;
  transport: MCPTransport | "http";
  command?: string | null;
  args?: string[];
  env?: Record<string, string>;
  url?: string | null;
  headers?: Record<string, string>;
  trustScope?: MCPTrustScope;
  trustedWorkspaceRoots?: string[];
  timeoutMs?: number;
  [key: string]: unknown;
}

export interface MCPConfig {
  mcp_servers: Record<string, MCPServerConfig>;
}

export interface MCPServerRuntimeStatus {
  id: string;
  enabled: boolean;
  transport: MCPTransport;
  trustScope: MCPTrustScope;
  available: boolean;
  status: "disabled" | "connected" | "error";
  toolCount: number;
  lastConnectedAt?: string;
  lastError?: string;
}

export interface MCPRuntimeDiagnostics {
  mcpServers: MCPServerRuntimeStatus[];
}
