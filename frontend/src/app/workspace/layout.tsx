"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { AuthProvider } from "@/core/auth/AuthProvider";
import { getDesktopSessionToken } from "@/core/auth/session";
import { buildLoginUrl, type User } from "@/core/auth/types";
import { getBackendBaseURL } from "@/core/config";

import { resolveWorkspaceGuardState } from "./auth-guard";
import { GatewayUnavailable } from "./gateway-unavailable";
import { WorkspaceContent } from "./workspace-content";

type GuardState =
  | { tag: "loading" }
  | { tag: "authenticated"; user: User }
  | { tag: "unauthenticated" }
  | { tag: "setup" }
  | { tag: "gateway_unavailable" };

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>({ tag: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const nextState = await resolveWorkspaceGuardState({
        baseUrl: getBackendBaseURL(),
        token: getDesktopSessionToken(),
      });
      if (!cancelled) setState(nextState);
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.tag === "unauthenticated") {
      router.replace(buildLoginUrl(pathname || "/workspace"));
    } else if (state.tag === "setup") {
      router.replace("/setup");
    }
  }, [state, pathname, router]);

  if (state.tag === "loading" || state.tag === "unauthenticated" || state.tag === "setup") {
    return null;
  }

  if (state.tag === "gateway_unavailable") {
    return <GatewayUnavailable />;
  }

  return (
    <AuthProvider initialUser={state.user}>
      <WorkspaceContent>{children}</WorkspaceContent>
    </AuthProvider>
  );
}
