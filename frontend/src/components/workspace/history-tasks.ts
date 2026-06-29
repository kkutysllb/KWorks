import type { AgentThreadContext } from "@/core/threads/types";

export type HistoryTaskThread = {
  thread_id: string;
  updated_at?: string | null;
  context?: Pick<AgentThreadContext, "workModeId"> | null;
  values?: { title?: string | null } | null;
};

export type HistoryTaskGroup<Thread extends HistoryTaskThread> = {
  id: string;
  label: string;
  count: number;
  threads: Thread[];
};

const DEFAULT_WORK_MODE_ID = "task";
const BUILTIN_WORK_MODE_ORDER = ["task", "coding"] as const;
const WORK_MODE_LABELS: Record<string, string> = {
  task: "日常办公",
  coding: "Coding 模式",
};

export function groupHistoryTasksByWorkMode<Thread extends HistoryTaskThread>(
  threads: Thread[],
): Array<HistoryTaskGroup<Thread>> {
  const groups = new Map<string, Thread[]>();
  for (const thread of threads) {
    const workModeId = historyTaskWorkModeId(thread);
    groups.set(workModeId, [...(groups.get(workModeId) ?? []), thread]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => compareWorkModeIds(a, b))
    .map(([id, groupThreads]) => ({
      id,
      label: historyTaskWorkModeLabel(id),
      count: groupThreads.length,
      threads: [...groupThreads].sort(compareHistoryTasks),
    }));
}

export function historyTaskWorkModeId(thread: HistoryTaskThread): string {
  const workModeId = thread.context?.workModeId?.trim();
  return workModeId !== undefined && workModeId.length > 0
    ? workModeId
    : DEFAULT_WORK_MODE_ID;
}

export function historyTaskWorkModeLabel(workModeId: string): string {
  return WORK_MODE_LABELS[workModeId] ?? workModeId;
}

function compareWorkModeIds(a: string, b: string): number {
  const aIndex = BUILTIN_WORK_MODE_ORDER.indexOf(
    a as (typeof BUILTIN_WORK_MODE_ORDER)[number],
  );
  const bIndex = BUILTIN_WORK_MODE_ORDER.indexOf(
    b as (typeof BUILTIN_WORK_MODE_ORDER)[number],
  );
  if (aIndex >= 0 || bIndex >= 0) {
    return (
      (aIndex >= 0 ? aIndex : Number.MAX_SAFE_INTEGER) -
      (bIndex >= 0 ? bIndex : Number.MAX_SAFE_INTEGER)
    );
  }
  return historyTaskWorkModeLabel(a).localeCompare(historyTaskWorkModeLabel(b));
}

function compareHistoryTasks(
  a: HistoryTaskThread,
  b: HistoryTaskThread,
): number {
  return timestampOfTask(b) - timestampOfTask(a);
}

function timestampOfTask(thread: HistoryTaskThread): number {
  const timestamp =
    thread.updated_at !== undefined && thread.updated_at !== null
      ? Date.parse(thread.updated_at)
      : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}
