"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type PromptInputMessage,
  PromptInputProvider,
} from "@/components/ai-elements/prompt-input";
import { ArtifactTrigger } from "@/components/workspace/artifacts";
import {
  ChatBox,
  useSpecificChatMode,
  useThreadChat,
} from "@/components/workspace/chats";
import { FinanceHtmlArtifactReader } from "@/components/workspace/finance/finance-html-artifact-reader";
import {
  InputBox,
  type InputBoxSubmitContext,
} from "@/components/workspace/input-box";
import {
  MessageList,
  MESSAGE_LIST_DEFAULT_PADDING_BOTTOM,
} from "@/components/workspace/messages";
import { ThreadContext } from "@/components/workspace/messages/context";
import { ThreadTitle } from "@/components/workspace/thread-title";
import { TodoList } from "@/components/workspace/todo-list";
import { Welcome } from "@/components/workspace/welcome";
import { WorkspaceHeaderPortal } from "@/components/workspace/workspace-header";
import { replaceWorkspaceRouteInPlace } from "@/core/navigation/workspace-route";
import { useNotification } from "@/core/notification/hooks";
import { useThreadSettings } from "@/core/settings";
import { useThreadStream } from "@/core/threads/hooks";
import { textOfMessage } from "@/core/threads/utils";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [todoPanelOccupiesSpace, setTodoPanelOccupiesSpace] = useState(false);
  const { threadId, setThreadId, isNewThread, setIsNewThread, isMock } =
    useThreadChat();
  const [settings, setSettings] = useThreadSettings(threadId);
  const urlWorkModeId = searchParams.get("workModeId") ?? undefined;
  const [appliedUrlWorkModeId, setAppliedUrlWorkModeId] = useState<
    string | null
  >(null);
  const mountedRef = useRef(false);
  const activeThreadIdRef = useRef(threadId);
  useSpecificChatMode();

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    activeThreadIdRef.current = threadId;
  }, [threadId]);

  useEffect(() => {
    if (isNewThread && searchParams.get("mode") === "coding") {
      router.replace("/workspace/coding");
    }
  }, [isNewThread, router, searchParams]);

  useEffect(() => {
    setAppliedUrlWorkModeId(null);
  }, [threadId, urlWorkModeId]);

  useEffect(() => {
    const activeSkillId = searchParams.get("skill") ?? undefined;
    const skillIntent = searchParams.get("intent") ?? undefined;
    const targetSkillId = searchParams.get("target") ?? undefined;
    const nextWorkModeId = urlWorkModeId ?? settings.context.workModeId;
    if (!activeSkillId && !skillIntent && !targetSkillId && !urlWorkModeId)
      return;
    if (
      settings.context.activeSkillId === activeSkillId &&
      settings.context.skillIntent === skillIntent &&
      settings.context.targetSkillId === targetSkillId &&
      settings.context.workModeId === nextWorkModeId
    ) {
      return;
    }
    setSettings("context", {
      ...settings.context,
      activeSkillId,
      skillIntent,
      targetSkillId,
      workModeId: nextWorkModeId,
    });
  }, [searchParams, setSettings, settings.context, urlWorkModeId]);

  useEffect(() => {
    if (
      isNewThread &&
      urlWorkModeId &&
      settings.context.workModeId === urlWorkModeId
    ) {
      setAppliedUrlWorkModeId(urlWorkModeId);
    }
  }, [isNewThread, settings.context.workModeId, urlWorkModeId]);

  const shouldUseUrlWorkMode =
    isNewThread &&
    Boolean(urlWorkModeId) &&
    appliedUrlWorkModeId !== urlWorkModeId;
  const chatContext = useMemo(
    () =>
      shouldUseUrlWorkMode && urlWorkModeId
        ? { ...settings.context, workModeId: urlWorkModeId }
        : settings.context,
    [settings.context, shouldUseUrlWorkMode, urlWorkModeId],
  );

  const { showNotification } = useNotification();

  const {
    thread,
    sendMessage,
    isUploading,
    isHistoryLoading,
    hasMoreHistory,
    loadMoreHistory,
    pendingQueue,
    steerPending,
    removePending,
    approvalStore,
    onApprove,
    onDeny,
  } = useThreadStream({
    threadId: isNewThread ? undefined : threadId,
    context: chatContext,
    isMock,
    onSend: (_threadId) => {
      activeThreadIdRef.current = _threadId;
      setThreadId(_threadId);
      setIsNewThread(false);
    },
    onStart: (createdThreadId) => {
      activeThreadIdRef.current = createdThreadId;
      setThreadId(createdThreadId);
      setIsNewThread(false);
      // ! Important: Never use next.js router for navigation in this case, otherwise it will cause the thread to re-mount and lose all states. Use native history API instead.
      const nextPath = `/workspace/chats/${createdThreadId}`;
      replaceWorkspaceRouteInPlace(nextPath);
    },
    onFinish: (state) => {
      if (document.hidden || !document.hasFocus()) {
        let body = "Conversation finished";
        const lastMessage = state.messages.at(-1);
        if (lastMessage) {
          const textContent = textOfMessage(lastMessage);
          if (textContent) {
            body =
              textContent.length > 200
                ? textContent.substring(0, 200) + "..."
                : textContent;
          }
        }
        showNotification(state.title, { body });
      }
    },
  });
  const handleSubmit = useCallback(
    (message: PromptInputMessage, submitContext: InputBoxSubmitContext) => {
      void sendMessage(threadId, message, submitContext);
    },
    [sendMessage, threadId],
  );
  const handleStop = useCallback(async () => {
    await thread.stop();
  }, [thread]);

  const todoPanelContentOffsetClass =
    todoPanelOccupiesSpace && !isNewThread
      ? "xl:-translate-x-20 2xl:-translate-x-24"
      : "";

  return (
    <PromptInputProvider>
      <ThreadContext.Provider value={{ thread, isMock }}>
        {thread.values.workModeId === "finance" && (
          <FinanceHtmlArtifactReader threadId={threadId} />
        )}
        <ChatBox threadId={threadId}>
          <WorkspaceHeaderPortal slot="title">
            <ThreadTitle
              className="max-w-full"
              threadId={threadId}
              thread={thread}
            />
          </WorkspaceHeaderPortal>
          <WorkspaceHeaderPortal slot="actions">
            <ArtifactTrigger />
          </WorkspaceHeaderPortal>
          <div className="relative flex size-full min-h-0 justify-between">
            <main className="flex min-h-0 max-w-full grow flex-col">
              <div className="pointer-events-none absolute top-14 right-4 left-4 z-40 flex justify-end sm:right-6 sm:left-auto">
                <TodoList
                  className="pointer-events-auto"
                  todos={thread.values.todos}
                  onFloatingVisibilityChange={setTodoPanelOccupiesSpace}
                  variant="floating"
                />
              </div>
              <div className="flex size-full justify-center transition-transform duration-200 ease-out">
                <MessageList
                  className={cn(
                    "size-full transition-transform duration-200 ease-out",
                    todoPanelContentOffsetClass,
                  )}
                  threadId={threadId}
                  thread={thread}
                  paddingBottom={MESSAGE_LIST_DEFAULT_PADDING_BOTTOM}
                  hasMoreHistory={hasMoreHistory}
                  loadMoreHistory={loadMoreHistory}
                  isHistoryLoading={isHistoryLoading}
                  approvalStore={approvalStore}
                  onApprove={onApprove}
                  onDeny={onDeny}
                />
              </div>
              <div className="absolute right-0 bottom-0 left-0 z-30 flex justify-center px-4">
                <div
                  className={cn(
                    "relative w-full transition-transform duration-200 ease-out",
                    isNewThread && "-translate-y-[calc(50vh-128px)]",
                    isNewThread
                      ? "max-w-[min(52rem,calc(100vw-2rem))]"
                      : "max-w-[min(68rem,calc(100vw-2rem))]",
                    todoPanelContentOffsetClass,
                  )}
                >
                  {isNewThread && (
                    <div
                      className={cn(
                        "mx-auto mb-9 w-full max-w-(--container-width-sm)",
                      )}
                    >
                      <Welcome
                        collaborationPolicy={
                          chatContext.collaborationPolicy ?? "single"
                        }
                      />
                    </div>
                  )}
                  {mountedRef.current ? (
                    <InputBox
                      className="bg-background/5 w-full"
                      isNewThread={isNewThread}
                      initialWorkModeId={
                        searchParams.get("workModeId") ?? "office"
                      }
                      threadId={threadId}
                      autoFocus={isNewThread}
                      status={
                        thread.error
                          ? "error"
                          : thread.isLoading
                            ? "streaming"
                            : "ready"
                      }
                      context={chatContext}
                      disabled={isUploading}
                      onContextChange={(context) =>
                        setSettings("context", context)
                      }
                      onSubmit={handleSubmit}
                      onStop={handleStop}
                      pendingQueue={pendingQueue.map((entry) => ({
                        id: entry.id,
                        text: entry.message.text,
                        createdAt: entry.createdAt,
                      }))}
                      onSteerPending={steerPending}
                      onRemovePending={removePending}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "bg-background/5 h-32 w-full -translate-y-4 rounded-2xl",
                      )}
                    />
                  )}
                </div>
              </div>
            </main>
          </div>
        </ChatBox>
      </ThreadContext.Provider>
    </PromptInputProvider>
  );
}
