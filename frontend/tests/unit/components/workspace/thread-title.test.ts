// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ThreadTitle } from "@/components/workspace/thread-title";
import type { AgentThreadState } from "@/core/threads";
import type { BaseStream } from "@/core/threads/qiongqi-types";

vi.mock("@/core/i18n/hooks", () => ({
  useI18n: () => ({
    t: {
      pages: {
        appName: "KWorks",
        newChat: "New Chat",
        untitled: "Untitled",
      },
    },
  }),
}));

vi.mock("@/components/workspace/chats", () => ({
  useThreadChat: () => ({ isNewThread: false }),
}));

vi.mock("@/components/workspace/flip-display", () => ({
  FlipDisplay: ({ children }: { children: React.ReactNode }) => children,
}));

function streamWithValues(
  values: Partial<AgentThreadState>,
): BaseStream<AgentThreadState> {
  return {
    values: {
      title: "",
      messages: [],
      artifacts: [],
      ...values,
    },
    error: null,
    isLoading: false,
    isThreadLoading: false,
    messages: [],
    stop: vi.fn(async () => {}),
    submit: vi.fn(async () => {}),
  };
}

describe("ThreadTitle", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = undefined;
    container = undefined;
    vi.clearAllMocks();
  });

  test("prefixes the visible title with the selected work mode", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(ThreadTitle, {
          threadId: "thread-coding",
          thread: streamWithValues({
            title: "检查当前项目",
            workModeId: "coding",
          }),
        }),
      );
    });

    expect(container.textContent).toBe("[Coding 模式] 检查当前项目");
  });
});
