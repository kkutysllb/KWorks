/**
 * qiongqi-native API client.
 *
 * Talks directly to the qiongqi runtime's `/v1/` REST endpoints for all
 * non-streaming calls (threads CRUD, turns, interrupt, todos).
 *
 * Design notes:
 *   - Uses the shared `fetch` from `api/fetcher` so CSRF + desktop bearer
 *     token injection is identical to every other REST call site.
 *   - Returns qiongqi-native `QiongqiThreadRecord` shapes. The companion
 *     `threadRecordToAgentThread` adapter mirrors the backend's
 *     `threadToKWorksResponse` + `itemToLangGraphMessage` so existing
 *     `AgentThread`-shaped consumers can be migrated incrementally.
 *   - `findActiveTurn()` replaces the old `runs.list` + "find running run"
 *     pattern: qiongqi exposes turns on the thread itself.
 */

import type { Todo } from "@/core/todos";

import { fetch } from "../api/fetcher";
import { getBackendBaseURL } from "../config";

import type { Message, ThreadStatus, TurnItem } from "./qiongqi-types";

// ---------------------------------------------------------------------------
// qiongqi-native shapes (subset of contracts consumed by the frontend).
// Kept loose (Record<string, unknown> extensions) because the authoritative
// Zod schemas live in `@qiongqi/contracts` on the backend; the frontend only
// needs the structural fields it actually reads.
// ---------------------------------------------------------------------------

export interface QiongqiTurn {
  id: string;
  threadId: string;
  status: "queued" | "running" | "completed" | "failed" | "aborted";
  prompt: string;
  model?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  items: TurnItem[];
  steering?: string[];
  [key: string]: unknown;
}

export interface QiongqiThreadRecord {
  id: string;
  title: string;
  workspace: string;
  model: string;
  mode?: string;
  workModeId?: string;
  status?: string;
  turns: QiongqiTurn[];
  goal?: Record<string, unknown> | null;
  todos?: { items?: Array<Record<string, unknown>> } | null;
  createdAt: string;
  updatedAt: string;
  latestSeq?: number;
  [key: string]: unknown;
}

export interface QiongqiThreadSummary {
  id: string;
  title: string;
  workspace: string;
  model: string;
  mode?: string;
  workModeId?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface StartTurnPayload {
  prompt: string;
  displayText?: string;
  model?: string;
  mode?: "agent" | "plan";
  workModeId?: string;
  reasoningEffort?: "off" | "low" | "medium" | "high" | "max";
  approvalPolicy?: "on-request" | "untrusted" | "never" | "auto" | "suggest";
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  attachmentIds?: string[];
}

export interface StartTurnResponse {
  turnId: string;
  userMessageItemId: string;
}

export interface UserInputAnswer {
  id: string;
  label: string;
  value: string;
}

export interface ResolveUserInputPayload {
  answers?: UserInputAnswer[];
  cancelled?: boolean;
}

export interface ResolveUserInputResponse {
  inputId: string;
  status: "submitted" | "cancelled";
  answers?: UserInputAnswer[];
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${getBackendBaseURL()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    // Surface HTTP status on the error object so callers can branch on 404/409
    // exactly like the legacy `apiClient.runs.cancel` path did.
    const body = await res.json().catch(() => ({}));
    const error = new Error(
      (body as { message?: string; detail?: string })?.message ??
        (body as { detail?: string })?.detail ??
        `request to ${path} failed with status ${res.status}`,
    ) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  // 204 No Content (e.g. DELETE) — return null cast to T.
  if (res.status === 204) {
    return null as unknown as T;
  }
  return (await res.json()) as T;
}

function encodePath(parts: TemplateStringsArray, ...values: string[]) {
  let out = "";
  for (let i = 0; i < parts.length; i += 1) {
    out += parts[i] ?? "";
    if (i < values.length) {
      const segment = values[i];
      if (typeof segment === "string") {
        out += encodeURIComponent(segment);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public client
// ---------------------------------------------------------------------------

export const qiongqiClient = {
  // --- Threads CRUD --------------------------------------------------------

  async listThreads(
    opts: {
      limit?: number;
      search?: string;
    } = {},
  ): Promise<QiongqiThreadSummary[]> {
    const params = new URLSearchParams();
    if (opts.limit !== undefined) {
      params.set("limit", String(opts.limit));
    }
    if (opts.search) {
      params.set("search", opts.search);
    }
    const qs = params.toString();
    const path = qs ? `/v1/threads?${qs}` : "/v1/threads";
    const body = await request<{ threads: QiongqiThreadSummary[] }>(path);
    return body.threads ?? [];
  },

  async getThread(threadId: string): Promise<QiongqiThreadRecord> {
    return request<QiongqiThreadRecord>(encodePath`/v1/threads/${threadId}`);
  },

  async createThread(input: {
    id?: string;
    title?: string;
    workspace: string;
    model?: string;
    mode?: string;
    workModeId?: string;
  }): Promise<QiongqiThreadRecord> {
    return request<QiongqiThreadRecord>("/v1/threads", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateThread(
    threadId: string,
    patch: {
      title?: string;
      model?: string;
      mode?: string;
      workModeId?: string;
      [key: string]: unknown;
    },
  ): Promise<QiongqiThreadRecord> {
    return request<QiongqiThreadRecord>(encodePath`/v1/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteThread(threadId: string): Promise<void> {
    await request<void>(encodePath`/v1/threads/${threadId}`, {
      method: "DELETE",
    });
  },

  // --- Todos ---------------------------------------------------------------

  async getThreadTodos(threadId: string): Promise<{
    todos: { items?: Array<Record<string, unknown>> } | null;
  }> {
    return request(encodedTodosPath(threadId));
  },

  async setThreadTodos(
    threadId: string,
    todos: { items?: Array<Record<string, unknown>> },
  ): Promise<{ todos: { items?: Array<Record<string, unknown>> } }> {
    return request(encodedTodosPath(threadId), {
      method: "POST",
      body: JSON.stringify({ todos }),
    });
  },

  // --- Turns (replaces runs.list / runs.cancel / runs.get) -----------------

  async startTurn(
    threadId: string,
    payload: StartTurnPayload,
  ): Promise<StartTurnResponse> {
    return request<StartTurnResponse>(
      encodePath`/v1/threads/${threadId}/turns`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async interruptTurn(
    threadId: string,
    turnId: string,
    discard = false,
  ): Promise<{ threadId: string; turnId: string; status: string }> {
    return request(
      encodePath`/v1/threads/${threadId}/turns/${turnId}/interrupt`,
      {
        method: "POST",
        body: JSON.stringify({ discard }),
      },
    );
  },

  async getTurn(threadId: string, turnId: string): Promise<QiongqiTurn> {
    return request<QiongqiTurn>(
      encodePath`/v1/threads/${threadId}/turns/${turnId}`,
    );
  },

  async decideApproval(
    approvalId: string,
    decision: "allow" | "deny",
    reason?: string,
  ): Promise<{ approvalId: string; decision: "allow" | "deny"; status: string }> {
    return request(encodePath`/v1/approvals/${approvalId}`, {
      method: "POST",
      body: JSON.stringify({
        decision,
        ...(reason ? { reason } : {}),
      }),
    });
  },

  async resolveUserInput(
    inputId: string,
    payload: ResolveUserInputPayload,
  ): Promise<ResolveUserInputResponse> {
    return request<ResolveUserInputResponse>(
      encodePath`/v1/user-inputs/${inputId}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
};

function encodedTodosPath(threadId: string) {
  return `/v1/threads/${encodeURIComponent(threadId)}/todos`;
}

// ---------------------------------------------------------------------------
// TurnItem -> Message adapter.
//
// Mirrors the backend `itemToLangGraphMessage` in kworks-compat.ts so the
// frontend can reconstruct `Message[]` from a qiongqi thread record
// without a round-trip through the compat layer.
// ---------------------------------------------------------------------------

export function turnItemToMessage(item: TurnItem): Message {
  const id = item.id;
  const additional_kwargs = { qiongqi_item: item };
  if (item.kind === "user_message") {
    return {
      id,
      type: "human",
      role: "user",
      content: item.displayText ?? item.text,
      additional_kwargs,
    };
  }
  if (item.kind === "assistant_reasoning") {
    return {
      id,
      type: "ai",
      role: "assistant",
      content: "",
      additional_kwargs: { ...additional_kwargs, reasoning_content: item.text },
    };
  }
  if (item.kind === "assistant_text" || item.kind === "review") {
    const text = item.kind === "review" ? (item.reviewText ?? "") : item.text;
    return {
      id,
      type: "ai",
      role: "assistant",
      content: text,
      additional_kwargs,
    };
  }
  if (item.kind === "tool_result") {
    return {
      id,
      type: "tool",
      role: "tool",
      name: item.toolName,
      tool_call_id: item.callId,
      content:
        typeof item.output === "string"
          ? item.output
          : JSON.stringify(item.output),
      additional_kwargs,
    };
  }
  if (item.kind === "tool_call") {
    return {
      id,
      type: "ai",
      role: "assistant",
      content: item.summary ?? "",
      tool_calls: [
        { id: item.callId, name: item.toolName, args: item.arguments },
      ],
      additional_kwargs,
    };
  }
  if (item.kind === "user_input") {
    return {
      id,
      type: "ai",
      role: "assistant",
      content: "",
      additional_kwargs: { ...additional_kwargs, qiongqi_user_input: item },
    };
  }
  if (item.kind === "error") {
    if (isToolCatalogDriftDiagnostic(item)) {
      return {
        id,
        type: "system",
        role: "system",
        content: "",
        additional_kwargs: { ...additional_kwargs, hide_from_ui: true },
      };
    }
    return {
      id,
      type: "ai",
      role: "assistant",
      content: item.message,
      additional_kwargs,
    };
  }
  return {
    id,
    type: "system",
    role: "system",
    content: JSON.stringify(item),
    additional_kwargs,
  };
}

function isToolCatalogDriftDiagnostic(item: TurnItem): item is Extract<
  TurnItem,
  { kind: "error" }
> & {
  code: "tool_catalog_changed";
} {
  return item.kind === "error" && item.code === "tool_catalog_changed";
}

// ---------------------------------------------------------------------------
// QiongqiThreadRecord -> AgentThread adapter.
//
// Produces the `AgentThread` shape that the rest of the frontend
// (message-list, history-task-list, hooks) consumes. This keeps the
// transport swap transparent to downstream components.
// ---------------------------------------------------------------------------

export interface AgentThreadLike {
  thread_id: string;
  created_at: string;
  updated_at: string;
  status: ThreadStatus;
  metadata: Record<string, unknown> | null;
  context?: { workModeId?: string; workspaceRoot?: string };
  values: {
    title: string;
    messages: Message[];
    artifacts: string[];
    todos?: unknown;
    thread_data: { runtime: "qiongqi"; thread_id: string };
    [key: string]: unknown;
  };
  interrupts: Record<string, unknown[]>;
  [key: string]: unknown;
}

export function threadRecordToAgentThread(
  thread: QiongqiThreadRecord,
): AgentThreadLike {
  const messages = thread.turns.flatMap((turn) =>
    turn.items.map(turnItemToMessage),
  );
  return {
    thread_id: thread.id,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
    status: thread.status === "running" ? "busy" : "idle",
    metadata: {},
    context: qiongqiThreadContext(thread),
    values: {
      title: thread.title,
      messages,
      artifacts: [],
      ...(thread.todos ? { todos: todoItemsFromThreadTodos(thread.todos) } : {}),
      thread_data: { runtime: "qiongqi", thread_id: thread.id },
    },
    interrupts: {},
  };
}

function todoItemsFromThreadTodos(todos: unknown): Todo[] {
  if (Array.isArray(todos)) return todos as Todo[];
  if (
    typeof todos === "object" &&
    todos !== null &&
    !Array.isArray(todos) &&
    Array.isArray((todos as { items?: unknown }).items)
  ) {
    return (todos as { items: Todo[] }).items;
  }
  return [];
}

export function threadSummaryToAgentThread(
  summary: QiongqiThreadSummary,
): AgentThreadLike {
  return {
    thread_id: summary.id,
    created_at: summary.createdAt,
    updated_at: summary.updatedAt,
    status: summary.status === "running" ? "busy" : "idle",
    metadata: {},
    context: qiongqiThreadContext(summary),
    values: {
      title: summary.title,
      messages: [],
      artifacts: [],
      thread_data: { runtime: "qiongqi", thread_id: summary.id },
    },
    interrupts: {},
  };
}

function qiongqiThreadContext(
  thread: Pick<QiongqiThreadRecord, "workspace" | "workModeId">,
): AgentThreadLike["context"] {
  const context: NonNullable<AgentThreadLike["context"]> = {};
  if (thread.workModeId?.trim()) {
    context.workModeId = thread.workModeId.trim();
  }
  if (thread.workspace?.trim()) {
    context.workspaceRoot = thread.workspace.trim();
  }
  return Object.keys(context).length > 0 ? context : undefined;
}

// ---------------------------------------------------------------------------
// Active-turn helper (replaces `runs.list` + find-running-run pattern).
// ---------------------------------------------------------------------------

/**
 * Return the most recent in-flight turn (running/queued) for a thread, or
 * `null` if none. qiongqi's turn list is chronological, so the last element
 * is the newest.
 */
export function findActiveTurn(
  thread: QiongqiThreadRecord,
): QiongqiTurn | null {
  for (let i = thread.turns.length - 1; i >= 0; i -= 1) {
    const turn = thread.turns[i];
    if (turn && (turn.status === "running" || turn.status === "queued")) {
      return turn;
    }
  }
  return null;
}
