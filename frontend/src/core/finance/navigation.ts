export const FINANCE_NEW_TASK_QUERY_PARAM = "new";
export const FINANCE_THREAD_QUERY_PARAM = "thread";
const FINANCE_THREAD_STORAGE_PREFIX = "finance:thread:";

/** Recover the module for legacy finance threads created before module IDs
 * were persisted on the server. This is only a same-device compatibility
 * fallback; new threads always carry workModeModuleId in Qiongqi. */
export function persistedFinanceModuleId(threadId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(FINANCE_THREAD_STORAGE_PREFIX)) continue;
      if (window.localStorage.getItem(key) === threadId) {
        const moduleId = key.slice(FINANCE_THREAD_STORAGE_PREFIX.length).trim();
        return moduleId || undefined;
      }
    }
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
  return undefined;
}

export function financeModulePath(
  moduleId: string,
  options: { newTask?: boolean; threadId?: string } = {},
): string {
  const path = `/workspace/finance/${encodeURIComponent(moduleId)}`;
  const params = new URLSearchParams();
  if (options.newTask) params.set(FINANCE_NEW_TASK_QUERY_PARAM, "1");
  if (options.threadId) params.set(FINANCE_THREAD_QUERY_PARAM, options.threadId);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function isFinanceNewTaskRequest(
  searchParams: Pick<URLSearchParams, "get">,
): boolean {
  return searchParams.get(FINANCE_NEW_TASK_QUERY_PARAM) === "1";
}
