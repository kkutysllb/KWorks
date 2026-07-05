import { useEffect } from "react";

import { useI18n } from "@/core/i18n/hooks";
import { useWorkModes } from "@/core/skills/hooks";
import type { AgentThreadState } from "@/core/threads";
import type { BaseStream } from "@/core/threads/qiongqi-types";
import { displayTitleOfThread, textOfMessage } from "@/core/threads/utils";

import { useThreadChat } from "./chats";
import { FlipDisplay } from "./flip-display";

export function ThreadTitle({
  threadId,
  thread,
}: {
  className?: string;
  threadId: string;
  thread: BaseStream<AgentThreadState>;
}) {
  const { t } = useI18n();
  const { isNewThread } = useThreadChat();
  const { workModes } = useWorkModes();
  const title = titleForDisplay(
    thread.values?.title,
    thread.messages,
    t.pages.newChat,
    t.pages.untitled,
  );
  const displayTitle = title
    ? displayTitleOfThread({
        values: {
          ...thread.values,
          title,
        },
        context: { workModeId: thread.values.workModeId },
      }, workModes)
    : null;

  useEffect(() => {
    let _title = t.pages.untitled;

    if (displayTitle) {
      _title = displayTitle;
    } else if (isNewThread) {
      _title = t.pages.newChat;
    }
    if (thread.isThreadLoading) {
      document.title = `Loading... - ${t.pages.appName}`;
    } else {
      document.title = `${_title} - ${t.pages.appName}`;
    }
  }, [
    isNewThread,
    t.pages.newChat,
    t.pages.untitled,
    t.pages.appName,
    thread.isThreadLoading,
    displayTitle,
  ]);

  if (!displayTitle) {
    return null;
  }
  return (
    <FlipDisplay uniqueKey={threadId}>
      {displayTitle}
    </FlipDisplay>
  );
}

function titleForDisplay(
  title: string | undefined,
  messages: BaseStream<AgentThreadState>["messages"],
  localizedNewChat: string,
  localizedUntitled: string,
): string | null {
  const trimmed = title?.trim() ?? "";
  if (trimmed && !isPlaceholderTitle(trimmed, localizedNewChat, localizedUntitled)) {
    return trimmed;
  }
  return titleFromFirstUserMessage(messages);
}

function isPlaceholderTitle(
  title: string,
  localizedNewChat: string,
  localizedUntitled: string,
): boolean {
  const normalized = title.trim().toLowerCase();
  return new Set([
    "new chat",
    "untitled",
    "新对话",
    "未命名",
    localizedNewChat.trim().toLowerCase(),
    localizedUntitled.trim().toLowerCase(),
  ]).has(normalized);
}

function titleFromFirstUserMessage(
  messages: BaseStream<AgentThreadState>["messages"],
): string | null {
  for (const message of messages) {
    if (message.type !== "human") continue;
    const text = textOfMessage(message)?.replace(/\s+/g, " ").trim();
    if (!text) continue;
    return text.length > 60 ? `${text.slice(0, 60)}...` : text;
  }
  return null;
}
