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

vi.mock("@/core/skills/hooks", () => ({
  useWorkModes: () => ({
    defaultModeId: "office",
    lockedSkillIds: [],
    isLoading: false,
    error: null,
    workModes: [
      {
        id: "office",
        name: "日常办公",
        skills: [],
      },
      {
        id: "coding",
        name: "Coding 模式",
        skills: [],
      },
      {
        id: "stock-quant",
        name: "股票量化",
        skills: [],
      },
    ],
  }),
}));

vi.mock("@/components/workspace/flip-display", () => ({
  FlipDisplay: ({ children }: { children: React.ReactNode }) => children,
}));

function streamWithValues(
  values: Partial<AgentThreadState>,
): BaseStream<AgentThreadState> {
  const resolvedValues = {
    title: "",
    messages: [],
    artifacts: [],
    ...values,
  };
  return {
    values: resolvedValues,
    error: null,
    isLoading: false,
    isThreadLoading: false,
    messages: resolvedValues.messages,
    stop: vi.fn(async () => undefined),
    submit: vi.fn(async () => undefined),
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

  test("prefixes custom work mode titles with the user-facing name", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(ThreadTitle, {
          threadId: "thread-stock",
          thread: streamWithValues({
            title: "当前工作模式下你有哪些技能",
            workModeId: "stock-quant",
          }),
        }),
      );
    });

    expect(container.textContent).toBe(
      "[股票量化] 当前工作模式下你有哪些技能",
    );
  });

  test("derives the visible title from the first user message when the stream title is a placeholder", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(ThreadTitle, {
          threadId: "thread-task",
          thread: streamWithValues({
            title: "New Chat",
            workModeId: "office",
            messages: [
              {
                type: "human",
                content: "你当前在什么工作模式下，有哪些技能可以调用",
              },
            ],
          }),
        }),
      );
    });

    expect(container.textContent).toBe(
      "[日常办公] 你当前在什么工作模式下，有哪些技能可以调用",
    );
  });
});
