import type { User } from "@/core/auth/types";

export type WorkspaceGuardState =
  | { tag: "authenticated"; user: User }
  | { tag: "unauthenticated" }
  | { tag: "setup" }
  | { tag: "gateway_unavailable" };

export async function resolveWorkspaceGuardState(input: {
  baseUrl: string;
  token: string | null;
  fetchImpl?: typeof fetch;
}): Promise<WorkspaceGuardState> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const meRes = await fetchImpl(`${input.baseUrl}/api/v1/auth/me`, {
      headers: input.token ? { Authorization: `Bearer ${input.token}` } : undefined,
      cache: "no-store",
    });

    if (meRes.ok) {
      const data = (await meRes.json()) as User;
      return data.needs_setup
        ? { tag: "setup" }
        : { tag: "authenticated", user: data };
    }

    if (meRes.status === 401 || meRes.status === 403) {
      try {
        const setupRes = await fetchImpl(`${input.baseUrl}/api/v1/auth/setup-status`, {
          cache: "no-store",
        });
        if (setupRes.ok) {
          const setupData = (await setupRes.json()) as { needs_setup?: boolean };
          if (setupData.needs_setup) {
            return { tag: "setup" };
          }
        }
      } catch {
        // fall through to unauthenticated
      }
      return { tag: "unauthenticated" };
    }

    return { tag: "gateway_unavailable" };
  } catch {
    return { tag: "gateway_unavailable" };
  }
}
