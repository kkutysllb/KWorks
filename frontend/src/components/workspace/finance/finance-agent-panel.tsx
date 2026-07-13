"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInputProvider,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
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
import { buildFinanceModulePrompt } from "@/core/finance/module-prompts";
import type { FinanceModule } from "@/core/finance/modules";
import { useThreadSettings } from "@/core/settings";
import { SubtasksProvider } from "@/core/tasks/context";
import { useThreadStream, useThreads } from "@/core/threads/hooks";
import type { Message } from "@/core/threads/qiongqi-types";
import type { Todo } from "@/core/todos";
import { isTodoWriteToolName } from "@/core/tools/utils";
import { cn } from "@/lib/utils";

import { FinanceHtmlArtifactReader } from "./finance-html-artifact-reader";

const FINANCE_AGENT_CONTENT_WIDTH_CLASS = "max-w-4xl";
// Right-padding gutter to reserve space for the floating TodoList panel,
// preventing overlap with chat content. 336px ≈ 320px panel + 16px gap.
const FINANCE_AGENT_FLOATING_PANEL_GUTTER_CLASS = "xl:pr-[336px]";

interface FinanceAgentPanelProps {
  module: FinanceModule;
  onTodosChange?: (todos: Todo[]) => void;
  /** When true, chat content gets right-padding so the floating TodoList
   *  panel doesn't overlap messages and the input box. */
  avoidRightFloatingPanels?: boolean;
}

/**
 * Finance Agent chat panel.
 *
 * Connects to the qiongqi runtime with the "finance" work-mode context.
 * Each module gets its own thread (persisted in localStorage), so switching
 * between analysis modules preserves conversations within a session.
 *
 * Stale thread IDs (e.g. after the user deletes the conversation from the
 * history list) are detected via the threads query and automatically reset
 * to a fresh new-thread state — no 404 errors.
 */
export function FinanceAgentPanel({
  module,
  onTodosChange,
  avoidRightFloatingPanels = false,
}: FinanceAgentPanelProps) {
  return (
    <SubtasksProvider>
      <PromptInputProvider>
        <FinanceAgentPanelInner
          module={module}
          onTodosChange={onTodosChange}
          avoidRightFloatingPanels={avoidRightFloatingPanels}
        />
      </PromptInputProvider>
    </SubtasksProvider>
  );
}

function FinanceAgentPanelInner({
  module,
  onTodosChange,
  avoidRightFloatingPanels = false,
}: FinanceAgentPanelProps) {
  const threadIdStorageKey = `finance:thread:${module.id}`;
  const [threadId, setThreadId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return window.localStorage.getItem(threadIdStorageKey) ?? undefined;
  });
  useEffect(() => {
    if (threadId) {
      window.localStorage.setItem(threadIdStorageKey, threadId);
    } else {
      window.localStorage.removeItem(threadIdStorageKey);
    }
  }, [threadId, threadIdStorageKey]);

  // Detect stale thread IDs restored from localStorage: if the persisted
  // thread was deleted (e.g. from the history task list), reset to a fresh
  // new-thread state instead of showing a 404.
  //
  // CRITICAL: only validate the INITIAL threadId restored from localStorage.
  // Never validate threadIds created at runtime by onStart — the threads
  // query cache hasn't propagated them yet, which would cause a false "stale"
  // reset and silently kill the outgoing stream.
  const initialThreadIdRef = useRef<string | undefined>(
    typeof window !== "undefined"
      ? (window.localStorage.getItem(threadIdStorageKey) ?? undefined)
      : undefined,
  );
  const { data: threads } = useThreads();
  useEffect(() => {
    const initialId = initialThreadIdRef.current;
    if (!initialId) return; // nothing to validate (fresh new thread)
    if (threads === undefined) return; // wait for first load
    initialThreadIdRef.current = undefined; // validate only once
    if (!threads.some((t) => t.thread_id === initialId)) {
      setThreadId(undefined);
    }
  }, [threads]);

  const uiThreadId = threadId ?? `finance-${module.id}`;
  const [settings, setSettings] = useThreadSettings(`finance:${module.id}`);
  const { textInput } = usePromptInputController();

  // Ensure the finance work mode is active, force agent mode (never plan).
  // Do NOT clear workspaceRoot — the backend resolves a default finance
  // workspace directory. Clearing it to undefined makes the agent think it
  // has no workspace and try writing to /tmp/ (which is sandbox-blocked).
  useEffect(() => {
    if (
      settings.context.workModeId !== "finance" ||
      settings.context.taskMode === "plan"
    ) {
      setSettings("context", {
        ...settings.context,
        workModeId: "finance",
        taskMode: "agent",
      });
    }
  }, [settings.context, setSettings]);

  const {
    thread,
    sendMessage,
    isHistoryLoading,
    hasMoreHistory,
    loadMoreHistory,
  } = useThreadStream({
    threadId,
    context: settings.context,
    onStart: (createdThreadId) => {
      setThreadId(createdThreadId);
    },
  });

  // Derive todos from thread state or tool calls, and emit them to the parent
  // workbench for the floating TodoList panel.
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

  const handleSubmit = useCallback(
    (message: PromptInputMessage, submitContext: InputBoxSubmitContext) => {
      void sendMessage(threadId, message, {
        additionalKwargs: {
          qiongqi_prompt_override: buildFinanceModulePrompt(
            module,
            message.text.trim(),
          ),
          displayText: message.text.trim(),
        },
        context: {
          ...submitContext,
          workModeId: "finance",
          taskMode: "agent",
          mode: "agent",
        },
      });
    },
    [module, sendMessage, threadId],
  );

  const handleStop = useCallback(async () => {
    await thread.stop();
  }, [thread]);

  const status = thread.error
    ? "error"
    : thread.isLoading
      ? "streaming"
      : "ready";

  return (
    <ThreadContext.Provider value={{ thread }}>
      <FinanceHtmlArtifactReader threadId={uiThreadId} />
      <ChatBox threadId={uiThreadId} artifactsMode="side-panel">
        <div className="relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden">
          {/* Messages */}
          <main className="relative flex min-h-0 min-w-0 grow flex-col overflow-hidden">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <MessageList
                className={cn(
                  "size-full min-w-0",
                  avoidRightFloatingPanels &&
                    FINANCE_AGENT_FLOATING_PANEL_GUTTER_CLASS,
                )}
                contentClassName={FINANCE_AGENT_CONTENT_WIDTH_CLASS}
                threadId={uiThreadId}
                thread={thread}
                paddingBottom={MESSAGE_LIST_DEFAULT_PADDING_BOTTOM}
                hasMoreHistory={hasMoreHistory}
                loadMoreHistory={loadMoreHistory}
                isHistoryLoading={isHistoryLoading}
              />
              {/* Input */}
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 z-30 flex min-w-0 justify-center px-3 pb-3 sm:px-5 sm:pb-4",
                  avoidRightFloatingPanels &&
                    FINANCE_AGENT_FLOATING_PANEL_GUTTER_CLASS,
                )}
              >
                <div
                  className={cn(
                    "relative flex w-full min-w-0 flex-col items-center gap-2",
                    FINANCE_AGENT_CONTENT_WIDTH_CLASS,
                  )}
                >
                  <div className="w-full min-w-0">
                    <InputBox
                      className="bg-background/5 min-h-28 w-full min-w-0 [&_[data-slot=input-group-control]]:min-h-16 [&_[data-slot=input-group]]:min-h-28"
                      threadId={uiThreadId}
                      autoFocus={false}
                      placeholder={module.promptHint}
                      status={status}
                      context={settings.context}
                      onContextChange={(context) =>
                        setSettings("context", context)
                      }
                      onSubmit={handleSubmit}
                      onStop={handleStop}
                    />
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Empty-state hint */}
          {thread.messages.length === 0 && !thread.isLoading && (
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 top-9 bottom-40 flex justify-center px-3 text-center sm:px-5",
                avoidRightFloatingPanels &&
                  FINANCE_AGENT_FLOATING_PANEL_GUTTER_CLASS,
              )}
            >
              <div
                className={cn(
                  "flex w-full min-w-0 flex-col items-center justify-center gap-3",
                  FINANCE_AGENT_CONTENT_WIDTH_CLASS,
                )}
              >
                <p className="text-lg font-semibold">
                  我是「小s」，金融分析助手
                </p>
                <p className="text-muted-foreground text-sm">
                  当前模块：
                  <span className="text-foreground font-medium">
                    {module.name}
                  </span>
                  ，已加载 {module.skillIds.length} 个专业技能包。
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {module.examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="bg-card text-muted-foreground hover:text-foreground pointer-events-auto rounded-lg border px-3 py-1.5 text-xs transition-colors hover:border-amber-500/40"
                      onClick={() => textInput.setInput(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <p className="text-muted-foreground/70 mt-2 text-xs">
                  所有分析基于技能获取的客观数据，不构成投资建议。
                </p>
              </div>
            </div>
          )}
        </div>
      </ChatBox>
    </ThreadContext.Provider>
  );
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
