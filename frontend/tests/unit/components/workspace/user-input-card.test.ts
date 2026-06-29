// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("@/core/api/fetcher", () => ({
  fetch: fetchMock,
}));

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "",
}));

vi.mock("@/core/i18n/hooks", () => ({
  useI18n: () => ({
    locale: "zh-CN",
    t: {
      userInput: {
        title: "需要你的确认",
        pending: "等待你补充信息，提交后模型会继续执行。",
        submitted: "已提交，模型正在继续执行。",
        cancelled: "已取消本次输入请求。",
        answerPlaceholder: "输入你的回答",
        detailsPlaceholder: "补充说明（可选）",
        submit: "提交",
        submitting: "提交中...",
        cancel: "取消",
        error: "提交失败，请稍后重试。",
      },
      clipboard: {
        copyToClipboard: "复制到剪贴板",
        copiedToClipboard: "已复制到剪贴板",
        failedToCopyToClipboard: "复制到剪贴板失败",
      },
    },
    changeLocale: vi.fn(),
  }),
}));

import { UserInputCard } from "@/components/workspace/messages/user-input-card";
import type { UserInputTurnItem } from "@/core/threads/qiongqi-types";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function userInputItem(): UserInputTurnItem {
  return {
    id: "item_in_1",
    threadId: "thread-1",
    turnId: "turn-1",
    role: "tool",
    status: "pending",
    createdAt: "2026-06-29T00:00:00.000Z",
    kind: "user_input",
    inputId: "in_1",
    prompt: "请确认目标技能",
    questions: [
      {
        header: "目标",
        id: "target",
        question: "你想创建哪个技能？",
        options: [
          { label: "代码审查", description: "审查代码改动" },
          { label: "文档生成", description: "生成项目文档" },
        ],
      },
    ],
  };
}

function renderCard(userInput: UserInputTurnItem) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(UserInputCard, { userInput }));
  });
  return { container, root };
}

describe("UserInputCard", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
  });

  test("renders pending user input and submits answers", async () => {
    const item = userInputItem();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        inputId: "in_1",
        status: "submitted",
        answers: [{ id: "target", label: "文档生成", value: "文档生成" }],
      }),
    } as Response);

    ({ container, root } = renderCard(item));

    expect(container.textContent).toContain("需要你的确认");
    expect(container.textContent).toContain("请确认目标技能");
    expect(container.textContent).toContain("你想创建哪个技能？");

    const option = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("文档生成"),
    );
    expect(option).not.toBeUndefined();
    await act(async () => {
      option?.click();
    });

    const submit = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "提交",
    );
    expect(submit).not.toBeUndefined();
    await act(async () => {
      submit?.click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/user-inputs/in_1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          answers: [{ id: "target", label: "文档生成", value: "文档生成" }],
        }),
      }),
    );
  });
});
