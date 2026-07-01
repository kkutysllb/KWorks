export function codingThreadStorageKey(projectId: string): string {
  return `coding:thread:${projectId}`;
}

export function codingProjectPath(projectId: string): string {
  return `/workspace/coding/${encodeURIComponent(projectId)}`;
}

export function codingProjectNewTaskPath(projectId: string): string {
  return `${codingProjectPath(projectId)}?new=1`;
}

export function codingProjectThreadPath(
  projectId: string,
  threadId: string,
): string {
  return `${codingProjectPath(projectId)}?thread=${encodeURIComponent(threadId)}`;
}
