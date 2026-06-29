// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { pushMock, createSkillMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  createSkillMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams("workModeId=coding"),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/core/skills/hooks", () => ({
  useCreateSkill: () => ({
    mutate: createSkillMock,
    isPending: false,
  }),
  useWorkModes: () => ({
    defaultModeId: "task",
    isLoading: false,
    error: null,
    workModes: [
      {
        id: "task",
        name: "日常办公",
        description: "",
        skills: [],
      },
      {
        id: "coding",
        name: "Coding 模式",
        description: "",
        skills: [],
      },
    ],
  }),
}));

import { SkillCreatePage } from "@/components/workspace/skills/skill-create-page";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(SkillCreatePage));
  });
  return { container, root };
}

function setField(container: HTMLElement, name: string, value: string) {
  const field = container.querySelector(`[name="${name}"]`) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
  expect(field).not.toBeNull();
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      field!.constructor.prototype,
      "value",
    )?.set;
    setter?.call(field, value);
    field!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("SkillCreatePage", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    pushMock.mockReset();
    createSkillMock.mockReset();
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

  test("submits the deterministic skill create request for the selected work mode", async () => {
    ({ container, root } = renderPage());

    expect(container.textContent).toContain("创建技能");
    expect(container.textContent).toContain("Coding 模式");

    setField(container, "id", "report-search");
    setField(container, "name", "研报搜索");
    setField(container, "description", "搜索和整理证券研究资料");
    setField(container, "trigger", "用户需要搜索研报或整理证券研究资料");
    setField(container, "output", "Markdown 摘要，包含来源、要点和后续问题");
    setField(container, "procedure", "1. 明确主题和范围\n2. 检索资料");

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(createSkillMock).toHaveBeenCalledWith(
      {
        id: "report-search",
        name: "研报搜索",
        description: "搜索和整理证券研究资料",
        trigger: "用户需要搜索研报或整理证券研究资料",
        output: "Markdown 摘要，包含来源、要点和后续问题",
        procedure: "1. 明确主题和范围\n2. 检索资料",
        workModeId: "coding",
      },
      expect.any(Object),
    );
  });
});
