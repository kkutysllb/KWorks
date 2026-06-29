/**
 * Pure event-dispatch logic extracted from {@link useAgentThread}'s
 * `onCustomEvent` callback so it can be unit-tested without mounting
 * a React component or the native stream harness.
 *
 * The handler is intentionally side-effect free apart from the injected
 * dependencies (`toast`, `updateSubtask`, `authorizePath`). This keeps
 * it deterministic and easy to assert against.
 */

import { toast } from "sonner";

import type { AIMessage } from "./qiongqi-types";

/** Shape of the desktop bridge's `authorizePath` IPC method. */
export type AuthorizePathFn = (params: {
  path: string;
  agentType: string;
  threadId?: string;
}) => Promise<{ authorized: boolean }>;

/** Callback used to feed `task_running` events into the subtask UI. */
export type UpdateSubtaskFn = (update: {
  id: string;
  latestMessage: AIMessage;
}) => void;

export type DecideApprovalFn = (
  approvalId: string,
  decision: "allow" | "deny",
  reason?: string,
) => Promise<unknown>;

/** All external collaborators the event handler needs. */
export interface StreamEventDependencies {
  /** Subtask context updater from `useUpdateSubtask`. */
  updateSubtask: UpdateSubtaskFn;
  /** Desktop bridge authorization method. When omitted (web build),
   *  `path_authorization_required` events are silently ignored. */
  authorizePath?: AuthorizePathFn;
  /** Resolves a pending QiongQi tool approval. */
  decideApproval?: DecideApprovalFn;
  /** Current thread id, forwarded to the desktop authorization dialog. */
  threadId?: string;
}

/**
 * Dispatch a single SSE custom event to the appropriate UI feedback.
 *
 * Supported event types:
 *  - `task_running`                → forward latest AI message to subtask UI
 *  - `path_authorization_required`  → toast + desktop authorization dialog
 *  - `subagent_limit_truncated`     → toast warning (tasks silently dropped)
 *  - `task_failed` / `task_timed_out` / `task_cancelled` → toast error
 *  - `llm_retry`                    → generic toast with retry message
 *
 * Unknown events are ignored (forwards-compatible with future backend types).
 */
export function handleStreamEvent(
  event: unknown,
  deps: StreamEventDependencies,
): void {
  const { updateSubtask, authorizePath, decideApproval, threadId } = deps;

  if (isRuntimeApprovalRequestedEvent(event)) {
    const summary = event.summary ?? `Run ${event.toolName}`;
    toast.info(`Agent 请求执行工具：${event.toolName}\n${summary}`, {
      action: {
        label: "允许",
        onClick: () => {
          void decideApproval?.(event.approvalId, "allow").catch(() => {
            toast.error("工具授权提交失败");
          });
        },
      },
      cancel: {
        label: "拒绝",
        onClick: () => {
          void decideApproval?.(event.approvalId, "deny").catch(() => {
            toast.error("工具拒绝提交失败");
          });
        },
      },
      duration: Infinity,
    });
    return;
  }

  if (!isObjectWithKey(event, "type")) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const type = (event as any).type;

  if (type === "task_running") {
    const e = event as {
      type: "task_running";
      task_id: string;
      message: AIMessage;
    };
    updateSubtask({ id: e.task_id, latestMessage: e.message });
    return;
  }

  if (type === "path_authorization_required") {
    const e = event as {
      type: "path_authorization_required";
      path: string;
      agent_type: string;
      read_only?: boolean;
      timeout_seconds?: number;
    };
    // Only the desktop shell has the authorizePath IPC bridge.
    if (authorizePath) {
      const timeoutHint = e.timeout_seconds
        ? `\n请在 ${Math.floor(e.timeout_seconds / 60)} 分钟内完成操作，超时将自动拒绝。`
        : "";
      toast.info(
        `Agent 请求访问路径：\n${e.path}\n请在弹出的对话框中选择是否授权。${timeoutHint}`,
      );
      void authorizePath({
        path: e.path,
        agentType: e.agent_type,
        threadId,
      })
        .then((result) => {
          if (!result.authorized) {
            toast.warning(`已拒绝路径访问：${e.path}`);
          }
        })
        .catch(() => {
          toast.error("路径授权对话框无法显示");
        });
    }
    return;
  }

  if (type === "subagent_limit_truncated") {
    const e = event as {
      type: "subagent_limit_truncated";
      dropped_count: number;
      max_concurrent: number;
    };
    toast.warning(
      `已达到子任务并发上限（${e.max_concurrent}），${e.dropped_count} 个任务被跳过。请等待当前任务完成后再试。`,
    );
    return;
  }

  if (type === "task_failed" || type === "task_timed_out" || type === "task_cancelled") {
    const e = event as {
      type: "task_failed" | "task_timed_out" | "task_cancelled";
      task_id: string;
      error?: string;
    };
    const labels: Record<string, string> = {
      task_failed: "子任务执行失败",
      task_timed_out: "子任务执行超时",
      task_cancelled: "子任务已取消",
    };
    const label = labels[type] ?? "子任务异常";
    const errorDetail = e.error ? `：${e.error}` : "";
    toast.error(`${label}${errorDetail}`);
    return;
  }

  if (
    type === "llm_retry" &&
    "message" in (event as object) &&
    typeof (event as { message: unknown }).message === "string" &&
    (event as { message: string }).message.trim()
  ) {
    const e = event as { type: "llm_retry"; message: string };
    toast(e.message);
  }

  // task_interrupted toast disabled per user request
  // Unknown event types are silently ignored.
}

/** Type guard: is `value` a non-null object that contains `key`? */
function isObjectWithKey(value: unknown, key: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    key in value
  );
}

function isRuntimeApprovalRequestedEvent(value: unknown): value is {
  kind: "approval_requested";
  approvalId: string;
  toolName: string;
  summary?: string;
} {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    event.kind === "approval_requested" &&
    typeof event.approvalId === "string" &&
    event.approvalId.trim().length > 0 &&
    typeof event.toolName === "string" &&
    event.toolName.trim().length > 0
  );
}
