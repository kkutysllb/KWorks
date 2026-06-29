/**
 * Frontend-native mirror of qiongqi runtime types.
 *
 * These types define the message / thread / run / stream shapes used across
 * the frontend, aligned to the qiongqi backend's `itemToLangGraphMessage`
 * output and the native `/v1/` API.
 *
 * This file is the single source of truth for thread/message types.
 *
 * Sources mirrored:
 *   - qiongqi message mapping: qiongqi/packages/http-layer/http/src/routes/kworks-compat.ts (itemToLangGraphMessage)
 *   - qiongqi TurnItem:  qiongqi/packages/foundation/contracts/src/items.ts
 *   - qiongqi events:    qiongqi/packages/foundation/contracts/src/events.ts
 */

// ---------------------------------------------------------------------------
// Message content primitives
// ---------------------------------------------------------------------------

export type ImageDetail = "auto" | "low" | "high";

export type MessageContentImageUrl = {
  type: "image_url";
  image_url:
    | string
    | {
        url: string;
        detail?: ImageDetail;
      };
};

export type MessageContentText = {
  type: "text";
  text: string;
};

export type MessageContentComplex = MessageContentText | MessageContentImageUrl;

export type MessageContent = string | MessageContentComplex[];

export type MessageAdditionalKwargs = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Base message + typed variants
// ---------------------------------------------------------------------------

export type BaseMessage = {
  additional_kwargs?: MessageAdditionalKwargs;
  content: MessageContent;
  id?: string;
  // `role` is emitted by the qiongqi backend's `itemToLangGraphMessage` for
  // compatibility but is NOT consumed by the frontend (it discriminates on
  // `type` instead). Kept optional so constructing messages from TurnItems
  // doesn't require `// @ts-expect-error`.
  role?: string;
  name?: string;
  response_metadata?: Record<string, unknown>;
};

export type HumanMessage = BaseMessage & {
  type: "human";
  example?: boolean;
};

export type DefaultToolCall = {
  name: string;
  // Tool arguments are intentionally permissive because individual tools expose
  // different argument shapes and UI consumers read known fields directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
  id?: string;
  type?: "tool_call";
};

export type InvalidToolCall = {
  name?: string;
  args?: string;
  id?: string;
  error?: string;
  type?: "invalid_tool_call";
};

export type UsageMetadata = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_token_details?: {
    audio?: number;
    cache_read?: number;
    cache_creation?: number;
  };
  output_token_details?: {
    audio?: number;
    reasoning?: number;
  };
};

 
export type AIMessage<ToolCall = DefaultToolCall> = BaseMessage & {
  type: "ai";
  example?: boolean;
  tool_calls?: ToolCall[];
  invalid_tool_calls?: InvalidToolCall[];
  usage_metadata?: UsageMetadata;
};

export type ToolMessage = BaseMessage & {
  type: "tool";
  status?: "error" | "success";
  tool_call_id: string;
  artifact?: unknown;
};

export type SystemMessage = BaseMessage & {
  type: "system";
};

export type FunctionMessage = BaseMessage & {
  type: "function";
};

export type RemoveMessage = BaseMessage & {
  type: "remove";
};

 
export type Message<ToolCall = DefaultToolCall> =
  | HumanMessage
  | AIMessage<ToolCall>
  | ToolMessage
  | SystemMessage
  | FunctionMessage
  | RemoveMessage;

// ---------------------------------------------------------------------------
// Thread / Run / Metadata
// ---------------------------------------------------------------------------

export type ThreadStatus = "idle" | "busy" | "interrupted" | "error";

// Permissive metadata shape — the qiongqi backend populates these fields
// when mapping runs/threads via its compatibility layer.
export type Metadata = {
  source?: "input" | "loop" | "update" | (string & {});
  step?: number;
  writes?: Record<string, unknown> | null;
  parents?: Record<string, string>;
  [key: string]: unknown;
} | null | undefined;

export type MultitaskStrategy = "reject" | "interrupt" | "rollback" | "enqueue";

// Run status values emitted by the qiongqi backend's kworks-compat layer
// via `runToResponse`.
export type RunStatus =
  | "pending"
  | "running"
  | "error"
  | "success"
  | "timeout"
  | "interrupted";

export type DefaultValues = Record<string, unknown>[] | Record<string, unknown>;

export interface Thread<ValuesType = DefaultValues> {
  thread_id: string;
  created_at: string;
  updated_at: string;
  metadata: Metadata;
  status: ThreadStatus;
  values: ValuesType;
  interrupts: Record<string, unknown[]>;
  config?: Record<string, unknown>;
  error?: string | Record<string, unknown> | null;
}

export interface Run {
  run_id: string;
  thread_id: string;
  assistant_id: string;
  created_at: string;
  updated_at: string;
  status: RunStatus;
  metadata: Metadata;
  // Optional multitask strategy (null when not specified).
  multitask_strategy?: MultitaskStrategy | null;
}

// ---------------------------------------------------------------------------
// BaseStream — the streaming interface consumed by hooks.ts and downstream
// components (values / messages / isLoading / stop / isThreadLoading /
// joinStream / submit).
// ---------------------------------------------------------------------------

export interface BaseStream<
  StateType extends Record<string, unknown> = Record<string, unknown>,
> {
  values: StateType;
  error: unknown;
  isLoading: boolean;
  isThreadLoading: boolean;
  messages: Message[];
  stop: () => Promise<void>;
  submit: (
    values: Partial<StateType> | null | undefined,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  joinStream?: (
    runId: string,
    lastEventId?: string,
    options?: Record<string, unknown>,
  ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// qiongqi-native types (mirrors contracts/src/items.ts + events.ts).
// Used by Phase 3 (qiongqi-stream) to consume raw RuntimeEvent from the
// native `/v1/threads/:id/events` SSE endpoint.
// ---------------------------------------------------------------------------

export type TurnItemRole = "user" | "assistant" | "system" | "tool";

export type TurnItemStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "aborted";

export interface TurnItemBase {
  id: string;
  turnId: string;
  threadId: string;
  role: TurnItemRole;
  status: TurnItemStatus;
  createdAt: string;
  finishedAt?: string;
}

export type UserTurnItem = TurnItemBase & {
  kind: "user_message";
  text: string;
  displayText?: string;
  attachmentIds?: string[];
};

export type AssistantTextTurnItem = TurnItemBase & {
  kind: "assistant_text";
  text: string;
};

export type AssistantReasoningTurnItem = TurnItemBase & {
  kind: "assistant_reasoning";
  text: string;
  signature?: string;
};

export type ToolCallTurnItem = TurnItemBase & {
  kind: "tool_call";
  toolName: string;
  callId: string;
  toolKind: "tool_call" | "command_execution" | "file_change";
  arguments: Record<string, unknown>;
  summary?: string;
};

export type ToolResultTurnItem = TurnItemBase & {
  kind: "tool_result";
  toolName: string;
  callId: string;
  toolKind: "tool_call" | "command_execution" | "file_change";
  output: unknown;
  isError?: boolean;
};

export type ApprovalTurnItem = TurnItemBase & {
  kind: "approval";
  approvalId: string;
  toolName: string;
  summary: string;
  status: "pending" | "allowed" | "denied" | "expired";
};

export type UserInputTurnItem = TurnItemBase & {
  kind: "user_input";
  inputId: string;
  prompt: string;
  questions: Array<{
    header: string;
    id: string;
    question: string;
    options: Array<{ label: string; description: string }>;
  }>;
  status: "pending" | "submitted" | "cancelled";
};

export type CompactionTurnItem = TurnItemBase & {
  kind: "compaction";
  summary: string;
  replacedTokens: number;
  pinnedConstraints: string[];
  sourceDigest?: string;
  digestMarker?: string;
  sourceItemIds?: string[];
};

export type ReviewTurnItem = TurnItemBase & {
  kind: "review";
  target: Record<string, unknown>;
  title: string;
  reviewText?: string;
  output?: Record<string, unknown>;
};

export type ErrorTurnItem = TurnItemBase & {
  kind: "error";
  message: string;
  code?: string;
  details?: unknown;
  severity?: string;
};

export type TurnItem =
  | UserTurnItem
  | AssistantTextTurnItem
  | AssistantReasoningTurnItem
  | ToolCallTurnItem
  | ToolResultTurnItem
  | ApprovalTurnItem
  | UserInputTurnItem
  | CompactionTurnItem
  | ReviewTurnItem
  | ErrorTurnItem;

export type TurnItemKind = TurnItem["kind"];

// ---------------------------------------------------------------------------
// RuntimeEvent (mirrors contracts/src/events.ts — the discriminated union
// pushed by `GET /v1/threads/:id/events`). Only the structural fields the
// frontend needs are mirrored; event-specific payload fields are kept loose.
// ---------------------------------------------------------------------------

export type RuntimeEventKind =
  | "thread_created"
  | "thread_updated"
  | "turn_started"
  | "turn_completed"
  | "turn_failed"
  | "turn_aborted"
  | "turn_steered"
  | "item_created"
  | "item_updated"
  | "item_completed"
  | "assistant_text_delta"
  | "assistant_reasoning_delta"
  | "tool_call_ready"
  | "tool_result_upload_wait"
  | "tool_storm_suppressed"
  | "tool_catalog_changed"
  | "tool_call_started"
  | "tool_call_finished"
  | "approval_requested"
  | "approval_resolved"
  | "user_input_requested"
  | "user_input_resolved"
  | "compaction_started"
  | "compaction_completed"
  | "goal_updated"
  | "goal_cleared"
  | "todos_updated"
  | "todos_cleared"
  | "pipeline_stage"
  | "usage"
  | "error"
  | "heartbeat";

export interface RuntimeEventBase {
  seq: number;
  timestamp: string;
  threadId: string;
  turnId?: string;
  itemId?: string;
  child?: {
    parentThreadId: string;
    parentTurnId: string;
    childId: string;
    childLabel?: string;
    childStatus: "queued" | "running" | "completed" | "failed" | "aborted";
    childSeq: number;
  };
}

export type ItemEvent = RuntimeEventBase & {
  kind:
    | "item_created"
    | "item_updated"
    | "item_completed"
    | "assistant_text_delta"
    | "assistant_reasoning_delta"
    | "tool_call_started"
    | "tool_call_finished";
  item: TurnItem;
};

export type ThreadLifecycleEvent = RuntimeEventBase & {
  kind: "thread_created" | "thread_updated";
  title?: string;
  status?: string;
};

export type TurnLifecycleEvent = RuntimeEventBase & {
  kind:
    | "turn_started"
    | "turn_completed"
    | "turn_failed"
    | "turn_aborted"
    | "turn_steered";
  status?: string;
  text?: string;
  message?: string;
  code?: string;
  details?: unknown;
  severity?: string;
};

export type RuntimeEvent =
  | ItemEvent
  | ThreadLifecycleEvent
  | TurnLifecycleEvent
  | (RuntimeEventBase & { kind: RuntimeEventKind; [key: string]: unknown });
