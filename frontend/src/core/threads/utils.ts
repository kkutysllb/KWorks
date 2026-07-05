import type { WorkMode } from "@/core/skills/type";
import { workModeDisplayNameById } from "@/core/skills/work-modes";

import type { Message } from "./qiongqi-types";
import type { AgentThreadContext } from "./types";

type ThreadTitleTarget = {
  values?: { title?: string | null } | null;
  context?: Pick<AgentThreadContext, "workModeId"> | null;
};

type ThreadRouteTarget =
  | string
  | {
      thread_id: string;
      context?: Pick<AgentThreadContext, "workModeId" | "projectId"> | null;
      metadata?: Record<string, unknown> | null;
    };

export function pathOfThread(thread: ThreadRouteTarget) {
  const threadId = typeof thread === "string" ? thread : thread.thread_id;
  if (typeof thread !== "string") {
    if (thread.context?.workModeId === "coding") {
      return thread.context.projectId
        ? `/workspace/coding/${encodeURIComponent(thread.context.projectId)}`
        : "/workspace/coding";
    }
  }

  return `/workspace/chats/${threadId}`;
}

export function textOfMessage(message: Message) {
  if (typeof message.content === "string") {
    return message.content;
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "text") {
        return part.text;
      }
    }
  }
  return null;
}

export function workModeLabelOfThread<
  Thread extends { context?: Pick<AgentThreadContext, "workModeId"> | null },
>(
  thread: Thread,
  workModes?: readonly Pick<WorkMode, "id" | "name">[],
) {
  const workModeId = thread.context?.workModeId?.trim();
  return workModeDisplayNameById(workModeId, workModes);
}

export function titleOfThread<Thread extends Pick<ThreadTitleTarget, "values">>(
  thread: Thread,
) {
  return thread.values?.title ?? "Untitled";
}

export function displayTitleOfThread<Thread extends ThreadTitleTarget>(
  thread: Thread,
  workModes?: readonly Pick<WorkMode, "id" | "name">[],
) {
  const workModeLabel = workModeLabelOfThread(thread, workModes);
  const title = titleOfThread(thread);
  return workModeLabel ? `[${workModeLabel}] ${title}` : title;
}
