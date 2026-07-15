"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { FinanceWorkbench } from "@/components/workspace/finance/finance-workbench";
import { isFinanceNewTaskRequest } from "@/core/finance/navigation";
import { useWorkspacePathname } from "@/core/navigation/workspace-route";

/**
 * Parse the moduleId segment from the URL path.
 *
 * Mirrors the coding workbench pattern: in the desktop static export build,
 * only `/workspace/finance/__init__` is pre-rendered. Parsing from
 * `usePathname()` sidesteps the stale RSC payload.
 */
function parseModuleIdFromPath(pathname: string | null): string {
  if (!pathname) return "";
  const match = /\/workspace\/finance\/([^/?#]+)/.exec(pathname);
  const raw = match?.[1];
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function FinanceModulePage() {
  const routerPathname = usePathname();
  const searchParams = useSearchParams();
  const pathname = useWorkspacePathname(routerPathname);
  const moduleId = parseModuleIdFromPath(pathname);
  return (
    <FinanceWorkbench
      moduleId={moduleId}
      startNewTask={isFinanceNewTaskRequest(searchParams)}
      threadId={searchParams.get("thread") ?? undefined}
    />
  );
}
