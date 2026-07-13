import { useMemo, useSyncExternalStore } from "react";

export const WORKSPACE_ROUTE_CHANGE_EVENT = "kworks:workspace-route-change";

type HistoryMode = "push" | "replace";

const FALLBACK_ORIGIN = "http://kworks.local";

function parseRoute(input: string): URL | null {
  try {
    return new URL(input, FALLBACK_ORIGIN);
  } catch {
    return null;
  }
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function workspaceShellKey(pathname: string): string | null {
  if (/^\/workspace\/chats\/([^/]+)\/?$/.test(pathname)) {
    return "chats";
  }

  // Coding: gallery (/workspace/coding) and project pages share the same shell
  if (/^\/workspace\/coding(\/[^/]+)?\/?$/.test(pathname)) {
    const codingMatch = /^\/workspace\/coding\/([^/]+)\/?$/.exec(pathname);
    return codingMatch?.[1] ? `coding:${decodeSegment(codingMatch[1])}` : "coding";
  }

  return null;
}

export function canNavigateWorkspaceInPlace(
  currentPath: string,
  targetPath: string,
): boolean {
  const current = parseRoute(currentPath);
  const target = parseRoute(targetPath);
  if (!current || !target) return false;

  const currentShell = workspaceShellKey(current.pathname);
  const targetShell = workspaceShellKey(target.pathname);
  if (currentShell === null || targetShell === null) return false;
  return currentShell === targetShell;
}

function currentFullPath(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function currentPathname(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

function currentSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

function emitWorkspaceRouteChange(): void {
  window.dispatchEvent(new Event(WORKSPACE_ROUTE_CHANGE_EVENT));
}

function updateBrowserHistory(path: string, mode: HistoryMode): void {
  const method = mode === "replace" ? "replaceState" : "pushState";
  window.history[method](null, "", path);
  emitWorkspaceRouteChange();
}

export function navigateWorkspaceInPlace(
  targetPath: string,
  options: { mode?: HistoryMode } = {},
): boolean {
  if (typeof window === "undefined") return false;
  const currentPath = currentFullPath();
  if (!canNavigateWorkspaceInPlace(currentPath, targetPath)) return false;
  if (currentPath !== targetPath) {
    updateBrowserHistory(targetPath, options.mode ?? "push");
  }
  return true;
}

export function replaceWorkspaceRouteInPlace(targetPath: string): void {
  if (typeof window === "undefined") return;
  updateBrowserHistory(targetPath, "replace");
}

function subscribeWorkspaceRoute(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(WORKSPACE_ROUTE_CHANGE_EVENT, listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener(WORKSPACE_ROUTE_CHANGE_EVENT, listener);
    window.removeEventListener("popstate", listener);
  };
}

export function useWorkspacePathname(
  fallbackPathname: string | null,
): string | null {
  const pathname = useSyncExternalStore(
    subscribeWorkspaceRoute,
    currentPathname,
    () => fallbackPathname ?? "",
  );
  return pathname || fallbackPathname;
}

export function useWorkspaceSearchParams(
  fallbackSearchParams: { toString(): string } | null,
): URLSearchParams {
  const fallback = fallbackSearchParams?.toString() ?? "";
  const search = useSyncExternalStore(
    subscribeWorkspaceRoute,
    currentSearch,
    () => fallback,
  );
  return useMemo(() => {
    const raw = search.startsWith("?") ? search.slice(1) : search;
    return new URLSearchParams(raw);
  }, [search]);
}
