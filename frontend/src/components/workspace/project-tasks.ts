import type { Project } from "@/core/projects";
import type { AgentThread, AgentThreadContext } from "@/core/threads/types";

export const PROJECT_TASKS_COLLAPSED_STORAGE_KEY =
  "kworks.sidebar.project-tasks.collapsed";

type ProjectTasksCollapseStorage = Pick<Storage, "getItem" | "setItem">;

export type ProjectTaskThread = Pick<
  AgentThread,
  "thread_id" | "updated_at" | "context" | "values" | "status"
>;

export type ProjectTaskBucket = {
  project: Pick<Project, "id" | "name" | "path">;
  isCurrent: boolean;
  runningCount: number;
  latestUpdatedAt: string | null;
  threads: ProjectTaskThread[];
};

export type ProjectTaskSummary = {
  buckets: ProjectTaskBucket[];
  unassignedThreads: ProjectTaskThread[];
};

export function buildProjectTaskSummary({
  projects,
  threads,
  currentWorkspaceRoot,
  maxThreadsPerProject = 3,
}: {
  projects: Array<Pick<Project, "id" | "name" | "path">>;
  threads: Array<AgentThread & ProjectTaskThread>;
  currentWorkspaceRoot?: string | null;
  maxThreadsPerProject?: number;
}): ProjectTaskSummary {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectByPath = new Map(
    projects.map((project) => [normalizeWorkspacePath(project.path), project]),
  );
  const currentPath = normalizeWorkspacePath(currentWorkspaceRoot ?? "");
  const threadsByProject = new Map<string, ProjectTaskThread[]>();
  const unassignedThreads: ProjectTaskThread[] = [];

  for (const thread of threads) {
    const project = resolveProjectForThread(
      thread.context,
      projectById,
      projectByPath,
    );
    if (!project) {
      unassignedThreads.push(thread);
      continue;
    }
    const grouped = threadsByProject.get(project.id) ?? [];
    grouped.push(thread);
    threadsByProject.set(project.id, grouped);
  }

  const buckets = projects
    .map((project) => {
      const projectThreads = [...(threadsByProject.get(project.id) ?? [])].sort(
        compareThreadsByUpdatedAt,
      );
      return {
        project,
        isCurrent:
          currentPath.length > 0 &&
          normalizeWorkspacePath(project.path) === currentPath,
        runningCount: projectThreads.filter(isRunningThread).length,
        latestUpdatedAt: projectThreads[0]?.updated_at ?? null,
        threads: projectThreads.slice(0, maxThreadsPerProject),
      };
    })
    .filter((bucket) => bucket.isCurrent || bucket.threads.length > 0)
    .sort(compareProjectBuckets);

  return {
    buckets,
    unassignedThreads: [...unassignedThreads].sort(compareThreadsByUpdatedAt),
  };
}

export function normalizeWorkspacePath(path: string): string {
  return path.trim().replace(/\/+$/, "");
}

export function readProjectTasksCollapsed(
  storage: ProjectTasksCollapseStorage | undefined = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    const value = storage.getItem(PROJECT_TASKS_COLLAPSED_STORAGE_KEY);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

export function writeProjectTasksCollapsed(
  collapsed: boolean,
  storage: ProjectTasksCollapseStorage | undefined = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      PROJECT_TASKS_COLLAPSED_STORAGE_KEY,
      collapsed ? "1" : "0",
    );
  } catch {
    // Ignore storage failures so sidebar interaction still works.
  }
}

function resolveProjectForThread(
  context: Pick<AgentThreadContext, "projectId" | "workspaceRoot"> | null | undefined,
  projectById: Map<string, Pick<Project, "id" | "name" | "path">>,
  projectByPath: Map<string, Pick<Project, "id" | "name" | "path">>,
) {
  const byId = context?.projectId ? projectById.get(context.projectId) : undefined;
  if (byId) return byId;

  const workspaceRoot = context?.workspaceRoot
    ? normalizeWorkspacePath(context.workspaceRoot)
    : "";
  return workspaceRoot ? projectByPath.get(workspaceRoot) : undefined;
}

function compareProjectBuckets(a: ProjectTaskBucket, b: ProjectTaskBucket) {
  if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
  if (a.runningCount !== b.runningCount) return b.runningCount - a.runningCount;
  return timestampOf(b.latestUpdatedAt) - timestampOf(a.latestUpdatedAt);
}

function compareThreadsByUpdatedAt(a: ProjectTaskThread, b: ProjectTaskThread) {
  return timestampOf(b.updated_at) - timestampOf(a.updated_at);
}

function isRunningThread(thread: ProjectTaskThread): boolean {
  return thread.status === "busy";
}

function timestampOf(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getBrowserStorage(): ProjectTasksCollapseStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
