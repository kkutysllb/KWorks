"use client";

import { useQueryClient } from "@tanstack/react-query";
import { TerminalIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInputProvider,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { ChatBox } from "@/components/workspace/chats";
import {
  InputBox,
  type InputBoxSubmitContext,
} from "@/components/workspace/input-box";
import {
  MessageList,
  MESSAGE_LIST_DEFAULT_PADDING_BOTTOM,
} from "@/components/workspace/messages";
import { ThreadContext } from "@/components/workspace/messages/context";
import { useProject } from "@/core/projects";
import { useWorkspaceSearchParams } from "@/core/navigation/workspace-route";
import { codingThreadStorageKey } from "@/core/projects/coding-thread-routes";
import { useThreadSettings } from "@/core/settings";
import { SubtasksProvider } from "@/core/tasks/context";
import { useThreadStream } from "@/core/threads/hooks";
import type { Message } from "@/core/threads/qiongqi-types";
import type { Todo } from "@/core/todos";
import { isTodoWriteToolName } from "@/core/tools/utils";
import { cn } from "@/lib/utils";

interface AgentPanelProps {
  avoidRightFloatingPanels?: boolean;
  projectId: string;
  onThreadIdChange?: (threadId: string | undefined) => void;
  onTodosChange?: (todos: Todo[]) => void;
  onFocusFile?: (
    filePath: string,
    target?: "code" | "task-changes" | "diff" | "review",
    taskId?: string,
    line?: number | null,
  ) => void;
}

const CODING_AGENT_CONTENT_WIDTH_CLASS = "max-w-4xl";
const CODING_AGENT_FLOATING_PANEL_GUTTER_CLASS = "xl:pr-[356px]";

/**
 * Right-hand Coding Agent chat panel.
 *
 * Talks to the qiongqi runtime with Coding work-mode context and scopes the
 * agent to the open project by passing ``project_root`` (the project's
 * absolute path) as run context. One thread is derived per project so
 * conversations persist across page reloads within a session.
 */
export function AgentPanel({
  avoidRightFloatingPanels = false,
  projectId,
  onFocusFile,
  onThreadIdChange,
  onTodosChange,
}: AgentPanelProps) {
  return (
    <SubtasksProvider>
      <PromptInputProvider>
        <AgentPanelInner
          avoidRightFloatingPanels={avoidRightFloatingPanels}
          projectId={projectId}
          onFocusFile={onFocusFile}
          onThreadIdChange={onThreadIdChange}
          onTodosChange={onTodosChange}
        />
      </PromptInputProvider>
    </SubtasksProvider>
  );
}

function AgentPanelInner({
  avoidRightFloatingPanels = false,
  projectId,
  onThreadIdChange,
  onTodosChange,
  onFocusFile,
}: AgentPanelProps) {
  const { project } = useProject(projectId);
  const queryClient = useQueryClient();
  const routerSearchParams = useSearchParams();
  const searchParams = useWorkspaceSearchParams(routerSearchParams);
  // Persist the coding agent thread ID per-project so switching workspace tabs
  // (which unmounts this component) and coming back can rejoin the same run.
  // Without this, the backend keeps the run alive (onDisconnect:"continue") but
  // the frontend loses track of which thread to reconnect to.
  const threadIdStorageKey = codingThreadStorageKey(projectId);
  const [threadId, setThreadId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return window.localStorage.getItem(threadIdStorageKey) ?? undefined;
  });
  useEffect(() => {
    const routeThreadId = searchParams.get("thread");
    if (routeThreadId) {
      setThreadId(routeThreadId);
      onThreadIdChange?.(routeThreadId);
      return;
    }
    if (searchParams.get("new") === "1") {
      setThreadId(undefined);
      onThreadIdChange?.(undefined);
    }
  }, [onThreadIdChange, searchParams, threadIdStorageKey]);
  useEffect(() => {
    if (threadId) {
      window.localStorage.setItem(threadIdStorageKey, threadId);
    } else {
      window.localStorage.removeItem(threadIdStorageKey);
    }
  }, [projectId, threadId, threadIdStorageKey]);
  const uiThreadId = threadId ?? projectId;
  const [settings, setSettings] = useThreadSettings(`coding:${projectId}`);
  const { textInput } = usePromptInputController();
  const [draggingCodingPath, setDraggingCodingPath] = useState(false);
  const activeThreadIdForQueries = threadId;

  const syncCodingProjectContext = useCallback(() => {
    if (!project?.path) return;
    if (
      settings.context.workspaceRoot === project.path &&
      settings.context.workModeId === "coding"
    ) {
      return;
    }
    setSettings("context", {
      ...settings.context,
      workModeId: "coding",
      workspaceRoot: project.path,
    });
  }, [project?.path, setSettings, settings.context]);

  useEffect(() => {
    syncCodingProjectContext();
  }, [syncCodingProjectContext]);

  const refreshProjectFiles = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["projects", projectId, "files"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["projects", projectId, "file"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["projects", projectId, "diff"],
    });
  }, [projectId, queryClient]);

  // Invalidate the project delivery-stage query so the Workflow panel
  // picks up auto-accepted transitions and pending suggestions in real
  // time during the run, not just after remount.
  //
  // The stage query key is ["coding", "projects", projectRoot, "stage"].
  // We invalidate the ["coding", "projects"] prefix (exact:false) to
  // cover the current project regardless of whether ``project?.path``
  // is available yet (it may be undefined during initial load).
  const refreshStageState = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["coding", "projects"],
      exact: false,
    });
  }, [queryClient]);

  // Silent refresh: invalidates stage + files + sessions queries. Used by the
  // polling mechanism below during a run. The ONLY reliable signal during a run
  // is ``thread.isLoading`` (the gateway does not support the ``events`` stream
  // mode, so ``onToolEnd`` never fires).
  const silentRefreshAll = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["projects", projectId, "files"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["projects", projectId, "diff"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["coding", "projects"],
      exact: false,
    });
    if (activeThreadIdForQueries) {
      void queryClient.invalidateQueries({
        queryKey: ["coding", "sessions", activeThreadIdForQueries],
        exact: false,
      });
    }
  }, [activeThreadIdForQueries, projectId, queryClient]);

  const {
    thread,
    sendMessage,
    isHistoryLoading,
    hasMoreHistory,
    loadMoreHistory,
    streamThreadId,
    approvalStore,
    onApprove,
    onDeny,
  } = useThreadStream({
    threadId,
    context: settings.context,
    onStart: (createdThreadId) => {
      setThreadId(createdThreadId);
      onThreadIdChange?.(createdThreadId);
    },
    onToolEnd: (event) => {
      if (isFileMutationTool(event.name)) {
        refreshProjectFiles();
      }
      // suggest_delivery_stage (and any tool that may indirectly change
      // the stage, e.g. cold-start bootstrap on first dynamic-context
      // build) → refresh the stage query so the Workflow panel updates.
      // We refresh on *every* tool end (not just suggest_delivery_stage)
      // because the stage can change as a side-effect of other tools and
      // the cost of an extra invalidate is negligible.
      refreshStageState();
      // Invalidate coding session/event/roi queries so the results panels
      // pick up data written by the backend during the run.  Without this,
      // the initial fetch (fired at thread-creation time) returns empty and
      // React Query never refetches.
      if (activeThreadIdForQueries) {
        void queryClient.invalidateQueries({
          queryKey: ["coding", "sessions", activeThreadIdForQueries],
          exact: false,
        });
      }
    },
    onFinish: () => {
      refreshProjectFiles();
      // Belt-and-suspenders: refresh stage state after the run completes
      // so any transitions that happened during the run are reflected even
      // if individual onToolEnd events were missed.
      refreshStageState();
      // Final refresh of all coding session data after the run completes.
      if (activeThreadIdForQueries) {
        void queryClient.invalidateQueries({
          queryKey: ["coding", "sessions", activeThreadIdForQueries],
          exact: false,
        });
      }
    },
    // Reliable backup path: Qiongqi custom events are pushed by the backend
    // via SSE and do not depend on the stream hook's tool-end dispatch
    // (which can be unreliable in packaged/production builds).
    // We listen for file_changed events to refresh the file explorer and
    // always refresh the stage panel as a safety net.
    onQiongqiEvent: (event) => {
      if (
        event &&
        typeof event === "object" &&
        "type" in event &&
        (event as { type: string }).type === "file_changed"
      ) {
        refreshProjectFiles();
        refreshStageState();
      }
    },
  });

  // Belt-and-suspenders: propagate the stream hook's internal thread ID
  // to the parent (coding-workbench) via useEffect.  The onStart callback
  // above already does this, but if the callback chain breaks for any
  // reason (timing, stale closure, internal state), this effect ensures
  // the parent always gets the real thread ID once the stream starts.
  useEffect(() => {
    if (streamThreadId) {
      onThreadIdChange?.(streamThreadId);
    }
  }, [streamThreadId, onThreadIdChange]);

  // ── Active-run polling refresh ────────────────────────────────────
  // The gateway does NOT support the ``events`` stream mode, so
  // ``onToolEnd`` (which relies on LangChain ``on_tool_end`` events) NEVER
  // fires.  The backend also does not push ``adispatch_custom_event``, so
  // ``onCustomEvent`` / ``onQiongqiEvent`` never fire either.
  //
  // This means the ONLY reliable indicator that the agent is actively
  // working is ``thread.isLoading``.  While it is true, we poll-silently-
  // refresh all derived UI state (stage transitions, file explorer, coding
  // session events) every 2 seconds so the Workflow panel and file tree
  // update in real time during the run.
  //
  // When the run finishes (isLoading→false), one final refresh ensures the
  // final state is reflected.
  const isLoading = thread.isLoading;
  useEffect(() => {
    if (!isLoading) return;
    // Immediate refresh when the run starts.
    silentRefreshAll();
    const interval = window.setInterval(silentRefreshAll, 2000);
    return () => {
      window.clearInterval(interval);
    };
  }, [isLoading, silentRefreshAll]);
  // Final refresh when the run completes (isLoading transitions to false).
  useEffect(() => {
    if (!isLoading) {
      silentRefreshAll();
    }
  }, [isLoading, silentRefreshAll]);

  const handleSubmit = useCallback(
    (message: PromptInputMessage, submitContext: InputBoxSubmitContext) => {
      // Scope the coding agent to this project for file access and memory.
      const project_root = project?.path;
      void sendMessage(
        threadId,
        message,
        project_root
          ? {
              ...submitContext,
              project_root,
              project_id: projectId,
              memory_scope: {
                type: "coding_project",
                id: projectId,
                workspaceRoot: project_root,
              },
            }
          : submitContext,
      );
    },
    [sendMessage, threadId, project?.path, projectId],
  );

  const handleStop = useCallback(async () => {
    await thread.stop();
  }, [thread]);

  const appendCodingPathToInput = useCallback(
    (payload: CodingPathDragPayload) => {
      const prefix = payload.type === "directory" ? "目录" : "文件";
      const snippet = `@${prefix}:${payload.path}`;
      textInput.setInput(
        textInput.value.trim()
          ? `${textInput.value.trimEnd()}\n${snippet}`
          : snippet,
      );
    },
    [textInput],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (
      !event.dataTransfer.types.includes("application/x-kworks-coding-path")
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDraggingCodingPath(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDraggingCodingPath(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      const raw = event.dataTransfer.getData(
        "application/x-kworks-coding-path",
      );
      if (!raw) return;
      event.preventDefault();
      setDraggingCodingPath(false);
      const payload = parseCodingPathDragPayload(raw);
      if (payload) {
        appendCodingPathToInput(payload);
      }
    },
    [appendCodingPathToInput],
  );

  const handleOpenMessageFileChange = useCallback(
    (
      filePath: string,
      target: "code" | "task-changes" | "diff" = "task-changes",
    ) => {
      onFocusFile?.(filePath, target);
    },
    [onFocusFile],
  );

  const visibleTodos = useMemo(
    () => todosFromThreadStateOrToolCalls(thread.values.todos, thread.messages),
    [thread.values.todos, thread.messages],
  );
  const visibleTodosRef = useRef(visibleTodos);
  const visibleTodoSignature = useMemo(
    () => getTodoItemsSignature(visibleTodos),
    [visibleTodos],
  );
  useEffect(() => {
    visibleTodosRef.current = visibleTodos;
  }, [visibleTodos]);
  useEffect(() => {
    onTodosChange?.(visibleTodosRef.current);
  }, [onTodosChange, visibleTodoSignature]);
  useEffect(() => {
    return () => onTodosChange?.([]);
  }, [onTodosChange]);

  const status = thread.error
    ? "error"
    : thread.isLoading
      ? "streaming"
      : "ready";

  return (
    <ThreadContext.Provider value={{ thread }}>
      <ChatBox threadId={uiThreadId} artifactsMode="disabled">
        <div
          className={cn(
            "relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden",
            draggingCodingPath && "ring-2 ring-emerald-500/50 ring-inset",
          )}
          data-floating-panels={avoidRightFloatingPanels ? "visible" : "hidden"}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Messages */}
          <main className="relative flex min-h-0 min-w-0 grow flex-col overflow-hidden">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <MessageList
                className={cn(
                  "size-full min-w-0",
                  avoidRightFloatingPanels &&
                    CODING_AGENT_FLOATING_PANEL_GUTTER_CLASS,
                )}
                contentClassName={CODING_AGENT_CONTENT_WIDTH_CLASS}
                threadId={uiThreadId}
                thread={thread}
                paddingBottom={MESSAGE_LIST_DEFAULT_PADDING_BOTTOM}
                hasMoreHistory={hasMoreHistory}
                loadMoreHistory={loadMoreHistory}
                isHistoryLoading={isHistoryLoading}
                onOpenFileChange={
                  onFocusFile ? handleOpenMessageFileChange : undefined
                }
                approvalStore={approvalStore}
                onApprove={onApprove}
                onDeny={onDeny}
              />
              {/* Input */}
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 z-30 flex min-w-0 justify-center px-3 pb-3 sm:px-5 sm:pb-4",
                  avoidRightFloatingPanels &&
                    CODING_AGENT_FLOATING_PANEL_GUTTER_CLASS,
                )}
              >
                <div
                  className={cn(
                    "relative flex w-full min-w-0 flex-col items-center gap-2",
                    CODING_AGENT_CONTENT_WIDTH_CLASS,
                  )}
                >
                  <div
                    className="w-full min-w-0"
                    data-testid="coding-agent-input-shell"
                  >
                    <InputBox
                      className="bg-background/5 min-h-28 w-full min-w-0 [&_[data-slot=input-group-control]]:min-h-16 [&_[data-slot=input-group]]:min-h-28"
                      threadId={uiThreadId}
                      autoFocus={false}
                      status={status}
                      context={settings.context}
                      onContextChange={(context) =>
                        setSettings("context", context)
                      }
                      onSubmit={handleSubmit}
                      onStop={handleStop}
                      onPreviewResultFile={(filePath) =>
                        onFocusFile?.(filePath, "code")
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Empty-state hint shown before any messages */}
          {thread.messages.length === 0 && !thread.isLoading && (
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 top-9 flex justify-center px-3 text-center sm:px-5",
                avoidRightFloatingPanels &&
                  CODING_AGENT_FLOATING_PANEL_GUTTER_CLASS,
                "bottom-40",
              )}
            >
              <div
                className={cn(
                  "flex w-full min-w-0 flex-col items-center justify-center gap-2",
                  CODING_AGENT_CONTENT_WIDTH_CLASS,
                )}
              >
                <div className="bg-muted/50 flex h-12 w-12 items-center justify-center rounded-xl">
                  <TerminalIcon className="text-muted-foreground h-6 w-6" />
                </div>
                <p className="text-sm font-medium">与 Coding Agent 对话</p>
                <p className="text-muted-foreground max-w-[16rem] text-xs">
                  描述你的编程需求，Agent 可以读写文件、执行 Git
                  操作、运行测试等。
                </p>
              </div>
            </div>
          )}
          {draggingCodingPath && (
            <div className="bg-background/80 pointer-events-none absolute inset-0 z-40 flex items-center justify-center backdrop-blur-sm">
              <div className="rounded-md border px-3 py-2 text-sm shadow-sm">
                拖放到这里引用文件或目录
              </div>
            </div>
          )}
        </div>
      </ChatBox>
    </ThreadContext.Provider>
  );
}

interface CodingPathDragPayload {
  path: string;
  type: "file" | "directory";
}

function parseCodingPathDragPayload(raw: string): CodingPathDragPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CodingPathDragPayload>;
    if (
      typeof parsed.path === "string" &&
      (parsed.type === "file" || parsed.type === "directory")
    ) {
      return { path: parsed.path, type: parsed.type };
    }
  } catch {
    return null;
  }
  return null;
}

function isFileMutationTool(name: string) {
  return name === "write_file" || name === "str_replace" || name === "bash";
}

function todosFromThreadStateOrToolCalls(
  threadTodos: unknown,
  messages: readonly Message[],
): Todo[] {
  const currentTodos = normalizeTodoItems(threadTodos);
  if (currentTodos.length > 0) return currentTodos;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    const toolCalls = "tool_calls" in message ? message.tool_calls : undefined;
    if (!Array.isArray(toolCalls)) continue;
    for (let callIndex = toolCalls.length - 1; callIndex >= 0; callIndex -= 1) {
      const toolCall = toolCalls[callIndex];
      if (!toolCall || !isTodoWriteToolName(toolCall.name)) continue;
      const todos = normalizeTodoItems(
        (toolCall.args as { todos?: unknown } | undefined)?.todos,
      );
      if (todos.length > 0) return todos;
    }
  }

  return [];
}

function normalizeTodoItems(value: unknown): Todo[] {
  const rawItems = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [];
  return rawItems.filter(isRecord).map((item) => ({
    ...(typeof item.id === "string" ? { id: item.id } : {}),
    ...(typeof item.content === "string" ? { content: item.content } : {}),
    ...(item.status === "pending" ||
    item.status === "in_progress" ||
    item.status === "completed"
      ? { status: item.status }
      : {}),
  }));
}

function getTodoItemsSignature(todos: readonly Todo[]): string {
  return todos
    .map((todo, index) =>
      [todo.id ?? index, todo.content ?? "", todo.status ?? "pending"].join(
        ":",
      ),
    )
    .join("|");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
