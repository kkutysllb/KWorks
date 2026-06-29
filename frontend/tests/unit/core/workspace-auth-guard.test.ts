import { describe, expect, it } from "vitest";

import { resolveWorkspaceGuardState } from "@/app/workspace/auth-guard";

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("workspace auth guard", () => {
  it("routes unauthenticated first-run users to setup", async () => {
    const calls: string[] = [];
    const state = await resolveWorkspaceGuardState({
      baseUrl: "",
      token: null,
      fetchImpl: async (url) => {
        calls.push(String(url));
        if (String(url).endsWith("/api/v1/auth/me")) {
          return response(401, { code: "unauthorized" });
        }
        return response(200, { needs_setup: true });
      },
    });

    expect(state).toEqual({ tag: "setup" });
    expect(calls).toEqual(["/api/v1/auth/me", "/api/v1/auth/setup-status"]);
  });

  it("routes unauthenticated initialized systems to login", async () => {
    const state = await resolveWorkspaceGuardState({
      baseUrl: "",
      token: null,
      fetchImpl: async (url) =>
        String(url).endsWith("/api/v1/auth/me")
          ? response(401, { code: "unauthorized" })
          : response(200, { needs_setup: false }),
    });

    expect(state).toEqual({ tag: "unauthenticated" });
  });

  it("accepts an authenticated user", async () => {
    const state = await resolveWorkspaceGuardState({
      baseUrl: "",
      token: "session-token",
      fetchImpl: async () =>
        response(200, {
          id: "user_1",
          email: "user@example.com",
          system_role: "admin",
        }),
    });

    expect(state).toEqual({
      tag: "authenticated",
      user: {
        id: "user_1",
        email: "user@example.com",
        system_role: "admin",
      },
    });
  });
});
