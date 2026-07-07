// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  routerReplace,
  searchParamsGet,
  threadChatState,
  settingsState,
  setSettingsMock,
  sendMessageMock,
  streamOptions,
  showNotificationMock,
} = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  searchParamsGet: vi.fn((_key: string) => null as string | null),
  threadChatState: {
    current: {
      threadId: "thread-a",
      setThreadId: vi.fn(),
      isNewThread: false,
      setIsNewThread: vi.fn(),
      isMock: false,
    },
  },
  settingsState: {
      current: {
        context: {
        taskMode: "agent" as "agent" | "plan",
      },
    },
  },
  setSettingsMock: vi.fn(),
  sendMessageMock: vi.fn(async () => undefined),
  streamOptions: {
    current: undefined as
      | {
          onToolEnd?: (event: { name: string; data: unknown }) => void;
          onQiongqiEvent?: (event: unknown) => void;
        }
      | undefined,
  },
  showNotificationMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

vi.mock("@/components/workspace/artifacts", () => ({
  ArtifactTrigger: () => null,
}));

vi.mock("@/components/workspace/chats", () => ({
  ChatBox: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  useSpecificChatMode: vi.fn(),
  useThreadChat: () => threadChatState.current,
}));

vi.mock("@/components/workspace/export-trigger", () => ({
  ExportTrigger: () => null,
}));

vi.mock("@/components/workspace/input-box", () => ({
  InputBox: () => React.createElement("div", { "data-testid": "input-box" }),
}));

vi.mock("@/components/workspace/messages", () => ({
  MESSAGE_LIST_DEFAULT_PADDING_BOTTOM: 144,
  MessageList: () => React.createElement("div", { "data-testid": "messages" }),
}));

vi.mock("@/components/workspace/messages/context", () => ({
  ThreadContext: React.createContext(null),
}));

vi.mock("@/components/workspace/refresh-button", () => ({
  RefreshButton: () => null,
}));

vi.mock("@/components/workspace/thread-title", () => ({
  ThreadTitle: () => null,
}));

vi.mock("@/components/workspace/todo-list", () => ({
  TodoList: () => null,
}));

vi.mock("@/components/workspace/welcome", () => ({
  Welcome: () => null,
}));

vi.mock("@/core/i18n/hooks", () => ({
  useI18n: () => ({
    t: {
      common: {
        notAvailableInDemoMode: "Demo mode",
      },
    },
  }),
}));

vi.mock("@/core/notification/hooks", () => ({
  useNotification: () => ({ showNotification: showNotificationMock }),
}));

vi.mock("@/core/settings", () => ({
  useThreadSettings: () => [settingsState.current, setSettingsMock],
}));

vi.mock("@/core/threads/hooks", () => ({
  useThreadStream: vi.fn((options) => {
    streamOptions.current = options;
    return {
      thread: {
        messages: [],
        values: { todos: [] },
        isLoading: false,
        error: null,
        stop: vi.fn(async () => undefined),
      },
      sendMessage: sendMessageMock,
      isUploading: false,
      isHistoryLoading: false,
      hasMoreHistory: false,
      loadMoreHistory: vi.fn(),
    };
  }),
}));

vi.mock("@/core/threads/utils", () => ({
  textOfMessage: () => "",
}));

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_STATIC_WEBSITE_ONLY: "false",
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) =>
    values.filter(Boolean).join(" "),
}));

import ChatPage from "@/app/workspace/chats/[thread_id]/page";

const successfulToolEnd = {
  name: "create_plan",
  data: {
    plan_id: "plan_1",
    relative_path: ".qiongqisdd/plan/report.md",
  },
};

const successfulQiongqiEvent = {
  kind: "tool_call_finished",
  item: {
    kind: "tool_result",
    toolName: "create_plan",
    isError: false,
    output: {
      plan_id: "plan_1",
      relative_path: ".qiongqisdd/plan/report.md",
    },
  },
};

describe("chat page plan event behavior", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    document.body.innerHTML = "";
    routerReplace.mockReset();
    searchParamsGet.mockReset();
    searchParamsGet.mockReturnValue(null);
    threadChatState.current = {
      threadId: "thread-a",
      setThreadId: vi.fn(),
      isNewThread: false,
      setIsNewThread: vi.fn(),
      isMock: false,
    };
    settingsState.current = {
      context: {
        taskMode: "agent",
      },
    };
    setSettingsMock.mockReset();
    sendMessageMock.mockReset();
    sendMessageMock.mockResolvedValue(undefined);
    streamOptions.current = undefined;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = undefined;
    container = undefined;
  });

  function renderPage() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(React.createElement(ChatPage));
    });
  }

  test("create_plan completion events do not start hidden execution turns", async () => {
    renderPage();

    await act(async () => {
      streamOptions.current?.onToolEnd?.(successfulToolEnd);
      streamOptions.current?.onQiongqiEvent?.(successfulQiongqiEvent);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(setSettingsMock).not.toHaveBeenCalled();
  });

  test("explicit plan mode only saves the plan and does not auto execute", async () => {
    settingsState.current = {
      context: {
        taskMode: "plan",
      },
    };
    renderPage();

    await act(async () => {
      streamOptions.current?.onToolEnd?.(successfulToolEnd);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(setSettingsMock).not.toHaveBeenCalled();
  });
});
