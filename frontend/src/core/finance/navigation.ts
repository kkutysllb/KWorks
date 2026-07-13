export const FINANCE_NEW_TASK_QUERY_PARAM = "new";

export function financeModulePath(
  moduleId: string,
  options: { newTask?: boolean } = {},
): string {
  const path = `/workspace/finance/${encodeURIComponent(moduleId)}`;
  if (!options.newTask) return path;
  return `${path}?${FINANCE_NEW_TASK_QUERY_PARAM}=1`;
}

export function isFinanceNewTaskRequest(
  searchParams: Pick<URLSearchParams, "get">,
): boolean {
  return searchParams.get(FINANCE_NEW_TASK_QUERY_PARAM) === "1";
}
