"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { BackendStatusIndicator } from "@/components/desktop";
import { ArtifactTrigger } from "@/components/workspace/artifacts";
import {
  ChatBox,
  useSpecificChatMode,
  useThreadChat,
} from "@/components/workspace/chats";
import { ExportTrigger } from "@/components/workspace/export-trigger";
import { FollowupsProvider } from "@/components/workspace/followups-context";
import {
  InputBox,
  type InputBoxSubmitContext,
} from "@/components/workspace/input-box";
import {
  MessageList,
  MESSAGE_LIST_DEFAULT_PADDING_BOTTOM,
  MESSAGE_LIST_FOLLOWUPS_EXTRA_PADDING_BOTTOM,
} from "@/components/workspace/messages";
import { ThreadContext } from "@/components/workspace/messages/context";
import { RefreshButton } from "@/components/workspace/refresh-button";
import { ThreadTitle } from "@/components/workspace/thread-title";
import { TodoList } from "@/components/workspace/todo-list";
import { Welcome } from "@/components/workspace/welcome";
import { useI18n } from "@/core/i18n/hooks";
import { useNotification } from "@/core/notification/hooks";
import { useThreadSettings } from "@/core/settings";
import { useThreadStream } from "@/core/threads/hooks";
import { textOfMessage } from "@/core/threads/utils";
import { env } from "@/env";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFollowups, setShowFollowups] = useState(false);
  const [todoPanelOccupiesSpace, setTodoPanelOccupiesSpace] = useState(false);
  const { threadId, setThreadId, isNewThread, setIsNewThread, isMock } =
    useThreadChat();
  const [settings, setSettings] = useThreadSettings(threadId);
  const urlWorkModeId = searchParams.get("workModeId") ?? undefined;
  const [appliedUrlWorkModeId, setAppliedUrlWorkModeId] = useState<
    string | null
  >(null);
  const mountedRef = useRef(false);
  useSpecificChatMode();

  useEffect(() => {
    mountedRef.current = true;
  }, []);

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
  } = useThreadStream({
    threadId: isNewThread ? undefined : threadId,
    context: chatContext,
    isMock,
    onSend: (_threadId) => {
      setThreadId(_threadId);
      setIsNewThread(false);
    },
    onStart: (createdThreadId) => {
      setThreadId(createdThreadId);
      setIsNewThread(false);
      // ! Important: Never use next.js router for navigation in this case, otherwise it will cause the thread to re-mount and lose all states. Use native history API instead.
      const nextPath = `/workspace/chats/${createdThreadId}`;
      history.replaceState(null, "", nextPath);
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

  const messageListPaddingBottom =
    MESSAGE_LIST_DEFAULT_PADDING_BOTTOM +
    (showFollowups ? MESSAGE_LIST_FOLLOWUPS_EXTRA_PADDING_BOTTOM : 0);
  const todoPanelContentOffsetClass =
    todoPanelOccupiesSpace && !isNewThread
      ? "xl:-translate-x-20 2xl:-translate-x-24"
      : "";

  return (
    <ThreadContext.Provider value={{ thread, isMock }}>
      <FollowupsProvider>
        <ChatBox threadId={threadId}>
          <div className="relative flex size-full min-h-0 justify-between">
            <header
              className={cn(
                "absolute top-0 right-0 left-0 z-30 flex h-12 shrink-0 items-center px-4",
                isNewThread
                  ? "bg-background/0 backdrop-blur-none"
                  : "bg-background/80 shadow-xs backdrop-blur",
              )}
            >
              <div className="flex w-full items-center text-sm font-medium">
                <ThreadTitle threadId={threadId} thread={thread} />
              </div>
              <div className="flex items-center gap-2">
                <BackendStatusIndicator />
                <RefreshButton />
                <ExportTrigger threadId={threadId} />
                <ArtifactTrigger />
              </div>
            </header>
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
                    !isNewThread && "pt-10",
                    todoPanelContentOffsetClass,
                  )}
                  threadId={threadId}
                  thread={thread}
                  paddingBottom={messageListPaddingBottom}
                  hasMoreHistory={hasMoreHistory}
                  loadMoreHistory={loadMoreHistory}
                  isHistoryLoading={isHistoryLoading}
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
                        searchParams.get("workModeId") ?? "task"
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
                      disabled={
                        env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true" ||
                        isUploading
                      }
                      onContextChange={(context) =>
                        setSettings("context", context)
                      }
                      onFollowupsVisibilityChange={setShowFollowups}
                      onSubmit={handleSubmit}
                      onStop={handleStop}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "bg-background/5 h-32 w-full -translate-y-4 rounded-2xl",
                      )}
                    />
                  )}
                  {env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true" && (
                    <div className="text-muted-foreground/67 w-full translate-y-12 text-center text-xs">
                      {t.common.notAvailableInDemoMode}
                    </div>
                  )}
                </div>
              </div>
            </main>
          </div>
        </ChatBox>
      </FollowupsProvider>
    </ThreadContext.Provider>
  );
}
