// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_BACKEND_BASE_URL: "http://127.0.0.1:19987",
    NEXT_PUBLIC_RUNTIME_API_BASE_URL: "http://127.0.0.1:19987/api",
  },
}));

const fetchMock = vi.fn();

vi.mock("@/core/api/fetcher", () => ({
  fetch: (...args: unknown[]) => fetchMock(...args),
}));

import { addMCPServer, loadMCPRuntimeDiagnostics, updateMCPConfig } from "@/core/mcp/api";

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

describe("MCP API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (window as unknown as { kworksDesktop?: { gatewayPort: number } }).kworksDesktop =
      { gatewayPort: 19987 };
  });

  test("writes QiongQi MCP schema without legacy type or description fields", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ mcp_servers: {} }));
    fetchMock.mockResolvedValueOnce(okJson({ mcp_servers: {} }));

    await addMCPServer("filesystem", {
      enabled: true,
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      env: { NODE_ENV: "test" },
      headers: {},
      trustScope: "workspace",
      trustedWorkspaceRoots: ["/tmp"],
      timeoutMs: 30_000,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body).toEqual({
      mcp_servers: {
        filesystem: {
          enabled: true,
          transport: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
          env: { NODE_ENV: "test" },
          headers: {},
          trustScope: "workspace",
          trustedWorkspaceRoots: ["/tmp"],
          timeoutMs: 30_000,
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain('"type"');
    expect(JSON.stringify(body)).not.toContain('"description"');
    expect(JSON.stringify(body)).not.toContain('"oauth"');
  });

  test("normalizes HTTP transport aliases to streamable-http before writing", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ mcp_servers: {} }));

    await updateMCPConfig({
      mcp_servers: {
        remote: {
          enabled: true,
          transport: "http",
          url: "https://mcp.example.com",
          headers: { Authorization: "Bearer token" },
          env: {},
          args: [],
          trustScope: "user",
          trustedWorkspaceRoots: [],
          timeoutMs: 15_000,
        },
      },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.mcp_servers.remote.transport).toBe("streamable-http");
    expect(body.mcp_servers.remote.url).toBe("https://mcp.example.com");
    expect(body.mcp_servers.remote.trustScope).toBe("user");
  });

  test("loads runtime diagnostics from native runtime tools endpoint", async () => {
    fetchMock.mockResolvedValueOnce(okJson({
      mcpServers: [
        {
          id: "github",
          enabled: true,
          transport: "stdio",
          trustScope: "user",
          available: true,
          status: "connected",
          toolCount: 3,
        },
      ],
    }));

    const diagnostics = await loadMCPRuntimeDiagnostics();

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1/runtime/tools");
    expect(diagnostics.mcpServers[0]).toMatchObject({
      id: "github",
      status: "connected",
      toolCount: 3,
    });
  });
});
