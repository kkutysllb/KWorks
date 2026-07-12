import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

import { isDesktop } from "../config";
import { useI18n } from "../i18n/hooks";
import { isHiddenFromUIMessage, type FileInMessage } from "../messages/utils";
import type { LocalSettings } from "../settings";
import { useUpdateSubtask } from "../tasks/context";
import type { UploadedFileInfo } from "../uploads";
import { promptInputFilePartToFile, uploadFiles } from "../uploads";
import {
  getThreadRuntimeSnapshot,
  publishThreadRuntimeSnapshot,
  useThreadRuntimeSnapshot,
} from "../workspace-runtime";

import { createApprovalStore, type ApprovalStore } from "./approval-store";
import {
  qiongqiClient,
  threadSummaryToAgentThread,
  turnItemToMessage,
} from "./qiongqi-client";
import { useQiongqiStream } from "./qiongqi-stream";
import type { Message, Run } from "./qiongqi-types";
import { handleStreamEvent } from "./stream-event-handler";
import {
  getCachedThreadState,
  setCachedThreadState,
} from "./thread-state-store";
import type { AgentThread, AgentThreadState } from "./types";

export type ToolEndEvent = {
  name: string;
  data: unknown;
};

export type ThreadStreamOptions = {
  threadId?: string | null | undefined;
  context: LocalSettings["context"];
  isMock?: boolean;
  onSend?: (threadId: string) => void;
  onStart?: (threadId: string, runId: string) => void;
  onFinish?: (state: AgentThreadState) => void;
  onToolEnd?: (event: ToolEndEvent) => void;
  /** Fired for every Qiongqi custom SSE event (file_changed, task_*, etc.).
   *  Use this as a reliable backup to ``onToolEnd`` for refreshing UI state
   *  — custom events are pushed by the backend via SSE and do not depend on
   *  the stream hook's tool-end dispatch, which can be unreliable in
   *  packaged builds. */
  onQiongqiEvent?: (event: unknown) => void;
};

type SendMessageOptions = {
  additionalKwargs?: Record<string, unknown>;
};

/** A message buffered while a turn is streaming, waiting to be sent. */
type PendingSendEntry = {
  id: string;
  message: PromptInputMessage;
  extraContext?: Record<string, unknown>;
  options?: SendMessageOptions;
  createdAt: number;
};

type ThreadSubmitContext = LocalSettings["context"] &
  Record<string, unknown> & {
    model_name?: string;
    taskMode?: "agent" | "plan";
    executionProfile?: "fast" | "balanced" | "deep";
    collaborationPolicy?: "single" | "auto";
    reasoning_effort?: "minimal" | "low" | "medium" | "high";
    workModeId?: string;
  };

type DisplayThreadState = {
  messages: Message[];
  values: AgentThreadState;
  isLoading: boolean;
  error: unknown;
};

type StoppableThread<T> = T & {
  stop?: (...args: never[]) => unknown;
};

function qiongqiModeForSubmitContext(
  context: ThreadSubmitContext,
): "agent" | "plan" {
  if (context.mode === "agent" || context.mode === "plan") {
    return context.mode;
  }
  return isPlanningTaskMode(context.taskMode) ? "plan" : "agent";
}

function isPlanningTaskMode(
  taskMode: ThreadSubmitContext["taskMode"],
): boolean {
  return taskMode === "plan";
}

function mergeMessages(
  historyMessages: Message[],
  threadMessages: Message[],
  optimisticMessages: Message[],
): Message[] {
  historyMessages = dedupeMessagesForDisplay(historyMessages);
  threadMessages = dedupeMessagesForDisplay(threadMessages);
  optimisticMessages = dedupeMessagesForDisplay(optimisticMessages);

  const threadMessageIds = new Set(
    threadMessages
      .map((m) => ("tool_call_id" in m ? m.tool_call_id : m.id))
      .filter(Boolean),
  );

  // The overlap is a contiguous suffix of historyMessages (newest history == oldest thread).
  // Scan from the end: shrink cutoff while messages are already in thread, stop as soon as
  // we hit one that isn't — everything before that point is non-overlapping.
  let cutoff = historyMessages.length;
  for (let i = historyMessages.length - 1; i >= 0; i--) {
    const msg = historyMessages[i];
    if (!msg) {
      continue;
    }
    if (
      (msg?.id && threadMessageIds.has(msg.id)) ||
      ("tool_call_id" in msg && threadMessageIds.has(msg.tool_call_id))
    ) {
      cutoff = i;
    } else {
      break;
    }
  }

  const liveHumanSignatures = new Set(
    [...threadMessages, ...optimisticMessages]
      .map(humanMessageSignature)
      .filter((signature): signature is string => Boolean(signature)),
  );
  const dedupedHistory = historyMessages.slice(0, cutoff).filter((message) => {
    const signature = humanMessageSignature(message);
    return !signature || !liveHumanSignatures.has(signature);
  });
  const threadHumanSignatures = new Set(
    threadMessages
      .map(humanMessageSignature)
      .filter((signature): signature is string => Boolean(signature)),
  );
  const dedupedOptimistic = optimisticMessages.filter((message) => {
    const signature = humanMessageSignature(message);
    return !signature || !threadHumanSignatures.has(signature);
  });

  return [...dedupedHistory, ...threadMessages, ...dedupedOptimistic];
}

function dedupeMessagesForDisplay(messages: Message[]): Message[] {
  const byKey = new Map<string, Message>();
  const order: string[] = [];
  for (const message of messages) {
    const key = displayMessageKey(message);
    if (!key) {
      order.push(`index:${order.length}`);
      byKey.set(order[order.length - 1]!, message);
      continue;
    }
    if (!byKey.has(key)) {
      order.push(key);
    }
    byKey.set(key, message);
  }
  return order
    .map((key) => byKey.get(key))
    .filter((message): message is Message => Boolean(message));
}

function displayMessageKey(message: Message): string | null {
  const signature = humanMessageSignature(message);
  if (signature) {
    return signature;
  }
  if ("tool_call_id" in message && message.tool_call_id) {
    return `tool:${message.tool_call_id}`;
  }
  return message.id ? `${message.type}:${message.id}` : null;
}

function humanMessageSignature(message: Message): string | null {
  if (message.type !== "human") {
    return null;
  }
  const text = messageTextContent(message).trim();
  return text ? `human:${text}` : null;
}

function messageTextContent(message: Message): string {
  const content = message.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
      return "";
    })
    .join("");
}

function getStreamErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const message = Reflect.get(error, "message");
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    const detail = Reflect.get(error, "detail");
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    const nestedError = Reflect.get(error, "error");
    if (nestedError instanceof Error && nestedError.message.trim()) {
      return nestedError.message;
    }
    if (typeof nestedError === "string" && nestedError.trim()) {
      return nestedError;
    }
  }
  return "Request failed.";
}

/**
 * Detect a 409 Conflict from the backend, raised when a thread already has
 * an active run and a new run was created with the default "reject"
 * multitask strategy. In the desktop app this is common: switching tabs
 * unmounts the chat page (dropping the SSE connection) but
 * `onDisconnect:"continue"` keeps the run alive, so coming back and
 * resuming the conversation collides with the orphaned run. Detected in
 * `sendMessage` to retry with the "interrupt" strategy instead of leaving
 * the user stuck until the backend is restarted.
 */
function isThreadBusyConflict(error: unknown): boolean {
  if (error == null || typeof error !== "object") {
    return false;
  }
  const status = Reflect.get(error, "status");
  if (status === 409 || status === "409") {
    return true;
  }
  const message = Reflect.get(error, "message");
  if (
    typeof message === "string" &&
    /409|conflict|already running/i.test(message)
  ) {
    return true;
  }
  const detail = Reflect.get(error, "detail");
  if (typeof detail === "string" && /already running|conflict/i.test(detail)) {
    return true;
  }
  return false;
}

function isStaleStreamJoinError(error: unknown): boolean {
  if (error == null) {
    return false;
  }

  const parts: string[] = [];
  if (typeof error === "string") {
    parts.push(error);
  } else if (error instanceof Error) {
    parts.push(error.message);
  } else if (typeof error === "object") {
    const message = Reflect.get(error, "message");
    const detail = Reflect.get(error, "detail");
    const nestedError = Reflect.get(error, "error");
    if (typeof message === "string") parts.push(message);
    if (typeof detail === "string") parts.push(detail);
    if (nestedError instanceof Error) parts.push(nestedError.message);
    if (typeof nestedError === "string") parts.push(nestedError);
  }

  const text = parts.join(" ");
  return (
    /not active on this worker/i.test(text) && /cannot be streamed/i.test(text)
  );
}

function clearStoredStreamReconnectKey(threadId: string | null | undefined) {
  if (!threadId || typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(`lg:stream:${threadId}`);
  } catch {
    // ignore storage failures
  }
}

export function useThreadStream({
  threadId,
  context,
  isMock,
  onSend,
  onStart,
  onFinish,
  onToolEnd,
  onQiongqiEvent,
}: ThreadStreamOptions) {
  const { t } = useI18n();
  const runtimeSnapshot = useThreadRuntimeSnapshot(threadId);
  // ── Cross-mount state restoration ───────────────────────────────
  // On component remount, the stream reinitialises with empty messages and
  // `isLoading=false`. The user would
  // see a flash of empty content + ready→streaming state toggle before the
  // stream reconnects. We bridge that gap with a module-level cache of the
  // last displayed state so the remounted component renders the previous
  // messages immediately while the SSE reconnects silently in the background.
  const restoredStateRef = useRef<DisplayThreadState | null | undefined>(
    undefined,
  );
  const restoredThreadIdRef = useRef<string | null | undefined>(undefined);
  const normalizedRestoredThreadId = threadId ?? null;
  if (restoredThreadIdRef.current !== normalizedRestoredThreadId) {
    restoredThreadIdRef.current = normalizedRestoredThreadId;
    if (!normalizedRestoredThreadId) {
      restoredStateRef.current = null;
    } else {
      const runtimeState = getThreadRuntimeSnapshot(normalizedRestoredThreadId);
      restoredStateRef.current =
        runtimeState ??
        getCachedThreadState(normalizedRestoredThreadId) ??
        null;
    }
  }
  // Track the thread ID that is currently streaming to handle thread changes during streaming
  const [onStreamThreadId, setOnStreamThreadId] = useState(() => threadId);
  // Ref to track current thread ID across async callbacks without causing re-renders,
  // and to allow access to the current thread id in onUpdateEvent
  const threadIdRef = useRef<string | null>(threadId ?? null);
  // Stable in-memory registry of pending/resolved tool approvals. Using a ref
  // (not a bare const) is REQUIRED: `claimForTool` mutates (deletes) entries,
  // so a fresh store each render would lose the claimed-approval state and
  // break inline approval rendering (Task 9).
  const approvalStoreRef = useRef<ApprovalStore>(createApprovalStore());
  const startedRef = useRef(false);
  const listeners = useRef({
    onSend,
    onStart,
    onFinish,
    onToolEnd,
    onQiongqiEvent,
  });

  const {
    messages: history,
    hasMore: hasMoreHistory,
    loadMore: loadMoreHistory,
    loading: isHistoryLoading,
  } = useThreadHistory(onStreamThreadId ?? "", {
    deferInitialLoad: (restoredStateRef.current?.messages.length ?? 0) > 0,
  });

  // Keep listeners ref updated with latest callbacks
  useEffect(() => {
    listeners.current = {
      onSend,
      onStart,
      onFinish,
      onToolEnd,
      onQiongqiEvent,
    };
  }, [onSend, onStart, onFinish, onToolEnd, onQiongqiEvent]);

  useEffect(() => {
    const normalizedThreadId = threadId ?? null;
    if (!normalizedThreadId) {
      // Reset when the UI moves back to a brand new unsaved thread.
      startedRef.current = false;
      setOnStreamThreadId(normalizedThreadId);
    } else {
      setOnStreamThreadId(normalizedThreadId);
    }
    threadIdRef.current = normalizedThreadId;
  }, [threadId]);

  const handleStreamStart = useCallback((_threadId: string, _runId: string) => {
    threadIdRef.current = _threadId;
    if (pendingSubmitThreadIdRef.current !== null) {
      pendingSubmitThreadIdRef.current = _threadId;
    }
    if (!startedRef.current) {
      listeners.current.onStart?.(_threadId, _runId);
      startedRef.current = true;
    }
    setOnStreamThreadId(_threadId);
  }, []);

  const queryClient = useQueryClient();
  const updateSubtask = useUpdateSubtask();

  const thread = useQiongqiStream<AgentThreadState>({
    threadId: onStreamThreadId,
    isMock,
    onThreadId: (newThreadId: string) => {
      handleStreamStart(newThreadId, "");
    },
    onCreated: (meta) => {
      handleStreamStart(meta.thread_id, meta.run_id);
    },
    onToolEnd: (event) => {
      listeners.current.onToolEnd?.(event);
    },
    onCustomEvent: (event: unknown) => {
      handleStreamEvent(event, {
        updateSubtask,
        authorizePath:
          typeof window !== "undefined" && window.kworksDesktop
            ? (params) => window.kworksDesktop!.authorizePath(params)
            : undefined,
        decideApproval: (approvalId, decision, reason) =>
          qiongqiClient.decideApproval(approvalId, decision, reason),
        approvalStore: approvalStoreRef.current,
        threadId: threadIdRef.current ?? undefined,
      });
      listeners.current.onQiongqiEvent?.(event);
    },
    onError: (error) => {
      const errMsg = error instanceof Error ? error.message : String(error);
      setOptimisticMessages([]);
      if (isStaleStreamJoinError(error)) {
        clearStoredStreamReconnectKey(threadIdRef.current ?? onStreamThreadId);
        void queryClient.invalidateQueries({ queryKey: ["threads", "search"] });
        if (threadIdRef.current ?? onStreamThreadId) {
          void queryClient.invalidateQueries({
            queryKey: ["thread", threadIdRef.current ?? onStreamThreadId],
          });
        }
        return;
      }
      if (
        isDesktop() &&
        (errMsg.includes("network error") || errMsg.includes("Failed to fetch"))
      ) {
        return;
      }
      toast.error(getStreamErrorMessage(error));
    },
    onFinish: (state) => {
      listeners.current.onFinish?.(state);
      void queryClient.invalidateQueries({ queryKey: ["threads", "search"] });
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (!Array.isArray(key) || key[0] !== "coding") return false;
          if (key[1] === "projects" && key[3] === "stage") return true;
          if (key[1] === "sessions" && key[3] === "session") return true;
          return false;
        },
      });
    },
  });

  // Propagate title changes from the stream to the thread list cache
  // (replaces the old onUpdateEvent title-sync logic).
  useEffect(() => {
    if (!thread.values.title) return;
    void queryClient.setQueriesData(
      {
        queryKey: ["threads", "search"],
        exact: false,
      },
      (oldData: Array<AgentThread> | undefined) => {
        return oldData?.map((t) => {
          if (t.thread_id === threadIdRef.current) {
            return {
              ...t,
              values: {
                ...t.values,
                title: thread.values.title,
              },
            };
          }
          return t;
        });
      },
    );
  }, [thread.values.title, queryClient]);

  // Optimistic messages shown before the server stream responds
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const sendInFlightRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const summarizedRef = useRef<Set<string>>(null);
  const pendingSubmitThreadIdRef = useRef<string | null>(null);
  // Track visible message count before sending so hidden middleware messages
  // do not prematurely clear the optimistic user bubble.
  const prevMsgCountRef = useRef(thread.messages.length);

  summarizedRef.current ??= new Set<string>();

  // Reset thread-local pending UI state when switching between threads so
  // optimistic messages and in-flight guards do not leak across chat views.
  useEffect(() => {
    const normalizedThreadId = threadId ?? null;
    const isActivatingPendingSubmit =
      !!normalizedThreadId &&
      pendingSubmitThreadIdRef.current === normalizedThreadId;
    startedRef.current = false;
    messagesRef.current = [];
    summarizedRef.current = new Set<string>();
    // Pending approvals belong to the previous thread; start fresh so they
    // don't get claimed by the new thread's tool cards.
    approvalStoreRef.current = createApprovalStore();
    if (!isActivatingPendingSubmit) {
      sendInFlightRef.current = false;
      setOptimisticMessages([]);
      // Pending messages belong to the previous thread; drop them on switch.
      setPendingQueue([]);
    }
  }, [threadId]);

  // Cache stop function in a ref so stopThread doesn't need thread in deps.
  const threadStopRef = useRef((thread as StoppableThread<typeof thread>).stop);
  threadStopRef.current = (thread as StoppableThread<typeof thread>).stop;

  // ── Pending send queue (feature: don't interrupt a running turn) ────────
  // When the user sends while a turn is streaming, the message is buffered
  // here instead of aborting the current task. On turn completion the first
  // queued entry is auto-sent; the user can also "steer" (inject into the
  // running turn) an entry immediately via the queue UI.
  const [pendingQueue, setPendingQueue] = useState<PendingSendEntry[]>([]);

  const enqueuePending = useCallback((entry: PendingSendEntry) => {
    setPendingQueue((queue) => [...queue, entry]);
  }, []);

  const removePending = useCallback((id: string) => {
    setPendingQueue((queue) => queue.filter((entry) => entry.id !== id));
  }, []);

  const clearPending = useCallback(() => {
    setPendingQueue([]);
  }, []);

  // Steer: inject a queued message into the currently-running turn without
  // aborting it. The backend SteeringQueue buffers the text and the loop drains
  // it at the next safe boundary, so the model sees the new requirement mid-task.
  const steerPending = useCallback(
    async (id: string) => {
      const entry = pendingQueue.find((item) => item.id === id);
      if (!entry) return;
      const targetThreadId = threadIdRef.current ?? onStreamThreadId;
      const activeTurnId = thread.getActiveTurnId?.();
      if (!targetThreadId || !activeTurnId) return;
      try {
        await qiongqiClient.steerTurn(targetThreadId, activeTurnId, entry.message.text);
        removePending(id);
      } catch {
        // leave the entry queued if the steer call fails
      }
    },
    [pendingQueue, onStreamThreadId, removePending, thread],
  );

  const stopThread = useCallback(async () => {
    const currentThreadId =
      threadIdRef.current ?? onStreamThreadId ?? undefined;
    try {
      try {
        await threadStopRef.current?.();
      } catch {
        // The local SSE controller may already be gone after tab switches or
        // renderer reloads. Cleanup below still needs to run so the UI exits
        // its pending state and future subscriptions start cleanly.
      }
    } finally {
      setOptimisticMessages([]);
      setIsUploading(false);
      sendInFlightRef.current = false;
      if (currentThreadId) {
        clearStoredStreamReconnectKey(currentThreadId);
        void queryClient.invalidateQueries({ queryKey: ["threads", "search"] });
        void queryClient.invalidateQueries({
          queryKey: ["thread", currentThreadId],
        });
      }
    }
  }, [onStreamThreadId, queryClient]);

  // useQiongqiStream handles reconnection internally via:
  //   • Initial thread fetch + SSE subscription on mount
  //   • Auto-reconnect with exponential backoff
  //   • Visibility change listener for desktop App Nap recovery

  const sendMessage = useCallback(
    async (
      requestedThreadId: string | undefined,
      message: PromptInputMessage,
      extraContext?: Record<string, unknown>,
      options?: SendMessageOptions,
    ) => {
      if (sendInFlightRef.current) {
        return;
      }

      const text = message.text.trim();
      // ── Interrupt-and-send ───────────────────────────────────────────
      // If a turn is currently streaming, interrupt it and immediately start
      // a new turn with this message. The backend discards partial assistant
      // items (keeps user items) and the new message gets full context.
      const shouldInterrupt = text && thread.isLoading;

      sendInFlightRef.current = true;
      pendingSubmitThreadIdRef.current = requestedThreadId ?? null;

      // Capture current count before showing optimistic messages
      prevMsgCountRef.current = thread.messages.filter(
        (msg) => !isHiddenFromUIMessage(msg),
      ).length;

      // Build optimistic files list with uploading status
      const optimisticFiles: FileInMessage[] = (message.files ?? []).map(
        (f) => ({
          filename: f.filename ?? "",
          size: 0,
          status: "uploading" as const,
        }),
      );

      const hideFromUI = options?.additionalKwargs?.hide_from_ui === true;
      const optimisticAdditionalKwargs = {
        ...options?.additionalKwargs,
        ...(optimisticFiles.length > 0 ? { files: optimisticFiles } : {}),
      };

      const newOptimistic: Message[] = [];
      if (!hideFromUI) {
        newOptimistic.push({
          type: "human",
          id: `opt-human-${Date.now()}`,
          content: text ? [{ type: "text", text }] : "",
          additional_kwargs: optimisticAdditionalKwargs,
        });
      }

      if (optimisticFiles.length > 0 && !hideFromUI) {
        // Mock AI message while files are being uploaded
        newOptimistic.push({
          type: "ai",
          id: `opt-ai-${Date.now()}`,
          content: t.uploads.uploadingFiles,
          additional_kwargs: { element: "task" },
        });
      }
      setOptimisticMessages(newOptimistic);

      if (threadId && requestedThreadId) {
        listeners.current.onSend?.(requestedThreadId);
      }

      let uploadedFileInfo: UploadedFileInfo[] = [];

      try {
        const baseSubmitContext: ThreadSubmitContext = {
          ...context,
          ...extraContext,
        };
        const submitContext = { ...baseSubmitContext } as ThreadSubmitContext & {
          sandboxMode?: unknown;
        };
        delete submitContext.sandboxMode;
        const buildSubmitContext = (targetThreadId: string | undefined) => {
          const mode = qiongqiModeForSubmitContext(submitContext);
          return {
            ...submitContext,
            mode,
            thinking_enabled: submitContext.executionProfile !== "fast",
            is_plan_mode: mode === "plan",
            subagent_enabled: submitContext.collaborationPolicy === "auto",
            reasoning_effort:
              submitContext.reasoning_effort ??
              (submitContext.executionProfile === "deep"
                ? "high"
                : submitContext.executionProfile === "balanced"
                  ? "medium"
                  : undefined),
            workModeId: submitContext.workModeId,
            thread_id: targetThreadId,
          };
        };
        let activeThreadId = requestedThreadId;

        // Upload files first if any
        if (message.files && message.files.length > 0) {
          setIsUploading(true);
          try {
            const filePromises = message.files.map((fileUIPart) =>
              promptInputFilePartToFile(fileUIPart),
            );

            const conversionResults = await Promise.all(filePromises);
            const files = conversionResults.filter(
              (file): file is File => file !== null,
            );
            const failedConversions = conversionResults.length - files.length;

            if (failedConversions > 0) {
              throw new Error(
                `Failed to prepare ${failedConversions} attachment(s) for upload. Please retry.`,
              );
            }

            if (!requestedThreadId) {
              throw new Error("Thread is not ready for file upload.");
            }

            activeThreadId = await thread.ensureThread(
              requestedThreadId,
              buildSubmitContext(requestedThreadId),
            );
            pendingSubmitThreadIdRef.current = activeThreadId;

            if (files.length > 0) {
              const uploadResponse = await uploadFiles(activeThreadId, files);
              uploadedFileInfo = uploadResponse.files;

              // Update optimistic human message with uploaded status + paths
              const uploadedFiles: FileInMessage[] = uploadedFileInfo.map(
                (info) => ({
                  filename: info.filename,
                  size: info.size,
                  path: info.virtual_path,
                  status: "uploaded" as const,
                }),
              );
              setOptimisticMessages((messages) => {
                if (messages.length > 1 && messages[0]) {
                  const humanMessage: Message = messages[0];
                  return [
                    {
                      ...humanMessage,
                      additional_kwargs: { files: uploadedFiles },
                    },
                    ...messages.slice(1),
                  ];
                }
                return messages;
              });
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Failed to upload files.";
            toast.error(errorMessage);
            setOptimisticMessages([]);
            throw error;
          } finally {
            setIsUploading(false);
          }
        }

        // Build files metadata for submission (included in additional_kwargs)
        const filesForSubmit: FileInMessage[] = uploadedFileInfo.map(
          (info) => ({
            filename: info.filename,
            size: info.size,
            path: info.virtual_path,
            status: "uploaded" as const,
          }),
        );

        // Wrap submit so we can retry with the "interrupt" multitask strategy
        // when the default returns 409 (another turn already active).
        const doSubmit = async (strategy?: "interrupt") => {
          await thread.submit(
            {
              messages: [
                {
                  type: "human",
                  content: [
                    {
                      type: "text",
                      text,
                    },
                  ],
                  additional_kwargs: {
                    ...options?.additionalKwargs,
                    ...(filesForSubmit.length > 0
                      ? { files: filesForSubmit }
                      : {}),
                  },
                },
              ],
            },
            {
              threadId: activeThreadId,
              multitaskStrategy: strategy,
              context: buildSubmitContext(activeThreadId),
            },
          );
        };

        try {
          await doSubmit(shouldInterrupt ? "interrupt" : undefined);
        } catch (error) {
          if (isThreadBusyConflict(error)) {
            toast.info("已有任务在运行，正在接管并继续…");
            await doSubmit("interrupt");
          } else {
            throw error;
          }
        }
        void queryClient.invalidateQueries({ queryKey: ["threads", "search"] });
      } catch (error) {
        setOptimisticMessages([]);
        setIsUploading(false);
        pendingSubmitThreadIdRef.current = null;
        throw error;
      } finally {
        sendInFlightRef.current = false;
      }
    },
    [thread, t.uploads.uploadingFiles, context, queryClient, threadId, enqueuePending],
  );

  // Cache the latest thread messages in a ref to compare against incoming history messages for deduplication,
  // and to allow access to the full message list in onUpdateEvent without causing re-renders.
  if (thread.messages.length >= messagesRef.current.length) {
    messagesRef.current = thread.messages;
  }

  const filteredThreadMessages = thread.messages.filter(
    (msg) => !isHiddenFromUIMessage(msg),
  );

  // Clear optimistic only when a visible server message arrives. Middleware
  // reminders are intentionally hidden from the UI and often arrive before the
  // user/assistant messages in desktop streams; treating them as a response
  // makes the just-sent user bubble disappear until another render occurs.
  useEffect(() => {
    if (
      optimisticMessages.length > 0 &&
      filteredThreadMessages.length > prevMsgCountRef.current
    ) {
      pendingSubmitThreadIdRef.current = null;
      setOptimisticMessages([]);
    }
  }, [filteredThreadMessages.length, optimisticMessages.length]);

  // Always merge all three sources.  When the outer `threadId` prop is still
  // undefined (brand-new thread — the stream hook creates the thread inside
  // submit() and only later calls onStart → setThreadId in the parent), the
  // internal stream may already be delivering messages.  The previous guard
  // `threadId ? merge : optimistic-only` discarded those live stream messages
  // during the ~100ms window between stream-start and parent re-render,
  // causing the user's message to "flash and disappear".
  //
  // Safe because when nothing has arrived yet, all three arrays are empty
  // and mergeMessages returns [].  When history loads for an existing thread,
  // it merges correctly.  When the stream delivers messages before the parent
  // propagates the new threadId, they still display.
  const mergedMessages = mergeMessages(
    history,
    filteredThreadMessages,
    optimisticMessages,
  );

  // ── Cross-mount display bridge ─────────────────────────────────
  // While the stream is reconnecting after a remount, `thread.messages` is
  // empty and `thread.isLoading` resets to false, causing a flash of empty
  // content and a ready-to-streaming status toggle. Until the live stream
  // produces its first message, fall back to the cached display state so the
  // UI stays visually identical across tab switches.  Once the stream has
  // data (or has definitively settled with no messages) the live values take
  // over seamlessly.
  const restored = runtimeSnapshot ?? restoredStateRef.current;
  const streamHasData = filteredThreadMessages.length > 0;
  const inReconnectTransition =
    !!threadId &&
    !streamHasData &&
    optimisticMessages.length === 0 &&
    !!restored;
  const displayMessages = inReconnectTransition
    ? restored.messages
    : mergedMessages;
  const displayIsLoading = inReconnectTransition
    ? restored.isLoading
    : thread.isLoading;

  // Persist the current display state so the next mount can restore it.
  // Only cache when we have meaningful data (non-empty messages or an active
  // streaming state) to avoid overwriting a good cache with an empty one.
  useEffect(() => {
    if (!threadId) return;
    const hasContent = displayMessages.length > 0 || displayIsLoading;
    if (!hasContent) return;
    const snapshot = {
      messages: displayMessages,
      values: thread.values,
      isLoading: displayIsLoading,
      error: thread.error,
    };
    publishThreadRuntimeSnapshot(threadId, snapshot);
    setCachedThreadState(threadId, snapshot);
  }, [
    threadId,
    displayMessages,
    displayIsLoading,
    thread.values,
    thread.error,
  ]);

  // ── Auto-drain the pending queue when a turn finishes ────────────────
  // When isLoading flips true → false and there's a buffered message, replay
  // the first entry as a real send. Uses a ref guard so we only fire on the
  // actual transition, not on every re-render while idle.
  const prevLoadingForDrainRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const wasLoading = prevLoadingForDrainRef.current === true;
    prevLoadingForDrainRef.current = displayIsLoading;
    if (wasLoading && !displayIsLoading && pendingQueue.length > 0 && !sendInFlightRef.current) {
      const next = pendingQueue[0];
      if (next) {
        setPendingQueue(pendingQueue.slice(1));
        // Fire-and-forget; sendMessage guards re-entry itself.
        void sendMessage(
          threadIdRef.current ?? onStreamThreadId ?? undefined,
          next.message,
          next.extraContext,
          next.options,
        );
      }
    }
  }, [displayIsLoading, pendingQueue, onStreamThreadId, sendMessage]);

  // Inline approval decision callbacks. These call the backend
  // `decideApproval` endpoint and also resolve the approval in the store so
  // any still-registered approvals reflect the decision. (Once an approval is
  // claimed by a tool card via `claimForTool` it is popped from the store, so
  // `resolve` is a no-op for it — the card's snapshot updates on the next
  // stream re-render instead.) Forwarded down to MessageGroup →
  // BashCommandCard in Task 9.
  const onApprove = useCallback((approvalId: string) => {
    approvalStoreRef.current.resolve(approvalId, "allowed");
    void qiongqiClient.decideApproval(approvalId, "allow");
  }, []);
  const onDeny = useCallback((approvalId: string) => {
    approvalStoreRef.current.resolve(approvalId, "denied");
    void qiongqiClient.decideApproval(approvalId, "deny");
  }, []);

  // Merge history, live stream, and optimistic messages for display
  // History messages may overlap with thread.messages; thread.messages take precedence
  const mergedThread = {
    ...thread,
    messages: displayMessages,
    isLoading: displayIsLoading,
    stop: stopThread,
  } as typeof thread;

  return {
    thread: mergedThread,
    sendMessage,
    isUploading,
    isHistoryLoading,
    hasMoreHistory,
    loadMoreHistory,
    // The real thread ID currently being streamed.  Updated by the stream
    // hook's onCreated callback (handleStreamStart).  Exposed so callers that
    // need the live thread ID (e.g. coding-workbench panels querying
    // session/event/roi APIs) don't have to rely solely on the onStart
    // callback chain.
    streamThreadId: onStreamThreadId ?? undefined,
    // Pending-send queue: messages buffered while a turn is streaming, so a
    // new send doesn't interrupt the running task. Auto-drains on turn finish.
    pendingQueue,
    enqueuePending,
    removePending,
    steerPending,
    clearPending,
    // Pending/resolved tool approvals, for inline rendering in command cards.
    approvalStore: approvalStoreRef.current,
    // Inline approval decision handlers (Task 9): wired to the backend
    // `decideApproval` endpoint and forwarded through MessageList →
    // MessageGroup → BashCommandCard.
    onApprove,
    onDeny,
  } as const;
}

export function useThreadHistory(
  threadId: string,
  options: { deferInitialLoad?: boolean } = {},
) {
  const { deferInitialLoad = false } = options;
  const threadIdRef = useRef(threadId);
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  loadingRef.current = loading;
  const loadMessages = useCallback(async () => {
    if (!threadIdRef.current || loadingRef.current) {
      return;
    }
    try {
      setLoading(true);
      const thread = await qiongqiClient.getThread(threadIdRef.current);
      const _messages = thread.turns
        .flatMap((turn) => turn.items)
        .map(turnItemToMessage)
        .filter((msg) => !isHiddenFromUIMessage(msg));
      setMessages(_messages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);
  // Clear messages and pagination cursors whenever the thread changes so
  // that history from the previous thread does not leak into the new view.
  // This is critical when navigating from a historical thread to a brand-new
  // chat: `useThreadRuns("")` returns an empty list and `loadMessages()`
  // early-returns, so without this reset the previous thread's messages would
  // persist in state and render behind the new-chat InputBox/Welcome.
  useEffect(() => {
    setMessages([]);
  }, [threadId]);

  useEffect(() => {
    threadIdRef.current = threadId;
    if (deferInitialLoad) {
      return;
    }
    loadMessages().catch(() => {
      toast.error("Failed to load thread history.");
    });
  }, [threadId, loadMessages, deferInitialLoad]);

  const appendMessages = useCallback((_messages: Message[]) => {
    setMessages((prev) => {
      return [...prev, ..._messages];
    });
  }, []);
  return {
    runs: [],
    messages,
    loading,
    appendMessages,
    hasMore: false,
    loadMore: loadMessages,
  };
}

export function useThreads(
  params: { limit?: number; search?: string } = { limit: 50 },
) {
  return useQuery<AgentThread[]>({
    queryKey: ["threads", "search", params],
    queryFn: async () => {
      const summaries = await qiongqiClient.listThreads({
        limit: params.limit,
        search: params.search,
      });
      return summaries.map(threadSummaryToAgentThread) as AgentThread[];
    },
    refetchOnWindowFocus: false,
  });
}

export function useThreadRuns(threadId?: string) {
  return useQuery<Run[]>({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      if (!threadId) {
        return [];
      }
      const thread = await qiongqiClient.getThread(threadId);
      return thread.turns.map((turn) => ({
        run_id: turn.id,
        thread_id: turn.threadId,
        assistant_id: "",
        created_at: turn.createdAt,
        updated_at: turn.finishedAt ?? turn.createdAt,
        status:
          turn.status === "running"
            ? "running"
            : turn.status === "queued"
              ? "pending"
              : turn.status === "failed"
                ? "error"
                : turn.status === "aborted"
                  ? "interrupted"
                  : "success",
        metadata: null,
      }));
    },
    refetchOnWindowFocus: false,
  });
}

export function useRunDetail(threadId: string, runId: string) {
  return useQuery<Run>({
    queryKey: ["thread", threadId, "run", runId],
    queryFn: async () => {
      const turn = await qiongqiClient.getTurn(threadId, runId);
      return {
        run_id: turn.id,
        thread_id: turn.threadId,
        assistant_id: "",
        created_at: turn.createdAt,
        updated_at: turn.finishedAt ?? turn.createdAt,
        status:
          turn.status === "running"
            ? "running"
            : turn.status === "queued"
              ? "pending"
              : turn.status === "failed"
                ? "error"
                : turn.status === "aborted"
                  ? "interrupted"
                  : "success",
        metadata: null,
      } satisfies Run;
    },
    refetchOnWindowFocus: false,
  });
}

export function useDeleteThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId }: { threadId: string }) => {
      await qiongqiClient.deleteThread(threadId);
    },
    onSuccess(_, { threadId }) {
      queryClient.setQueriesData(
        {
          queryKey: ["threads", "search"],
          exact: false,
        },
        (oldData: Array<AgentThread> | undefined) => {
          if (oldData == null) {
            return oldData;
          }
          return oldData.filter((t) => t.thread_id !== threadId);
        },
      );
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: ["threads", "search"] });
    },
  });
}

export function useRenameThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      threadId,
      title,
    }: {
      threadId: string;
      title: string;
    }) => {
      await qiongqiClient.updateThread(threadId, { title });
    },
    onSuccess(_, { threadId, title }) {
      queryClient.setQueriesData(
        {
          queryKey: ["threads", "search"],
          exact: false,
        },
        (oldData: Array<AgentThread>) => {
          return oldData.map((t) => {
            if (t.thread_id === threadId) {
              return {
                ...t,
                values: {
                  ...t.values,
                  title,
                },
              };
            }
            return t;
          });
        },
      );
    },
  });
}
