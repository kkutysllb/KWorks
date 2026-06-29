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
      context?: Pick<
        AgentThreadContext,
        "agent_name" | "workModeId" | "projectId"
      > | null;
      metadata?: Record<string, unknown> | null;
    };

export function pathOfThread(
  thread: ThreadRouteTarget,
  context?: Pick<AgentThreadContext, "agent_name"> | null,
) {
  const threadId = typeof thread === "string" ? thread : thread.thread_id;
  let agentName: string | undefined;
  if (typeof thread === "string") {
    agentName = context?.agent_name;
  } else {
    if (thread.context?.workModeId === "coding") {
      return thread.context.projectId
        ? `/workspace/coding/${encodeURIComponent(thread.context.projectId)}`
        : "/workspace/coding";
    }
    agentName = thread.context?.agent_name;
    if (!agentName) {
      const metaAgent = thread.metadata?.agent_name;
      if (typeof metaAgent === "string") {
        agentName = metaAgent;
      }
    }
  }

  return agentName
    ? `/workspace/agents/${encodeURIComponent(agentName)}/chats/${threadId}`
    : `/workspace/chats/${threadId}`;
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

const WORK_MODE_LABELS: Record<string, string> = {
  task: "日常办公",
  coding: "Coding 模式",
};

export function workModeLabelOfThread<
  Thread extends { context?: Pick<AgentThreadContext, "workModeId"> | null },
>(thread: Thread) {
  const workModeId = thread.context?.workModeId?.trim();
  if (!workModeId) return null;
  return WORK_MODE_LABELS[workModeId] ?? workModeId;
}

export function titleOfThread<Thread extends Pick<ThreadTitleTarget, "values">>(
  thread: Thread,
) {
  return thread.values?.title ?? "Untitled";
}

export function displayTitleOfThread<Thread extends ThreadTitleTarget>(
  thread: Thread,
) {
  const workModeLabel = workModeLabelOfThread(thread);
  const title = titleOfThread(thread);
  return workModeLabel ? `[${workModeLabel}] ${title}` : title;
}
