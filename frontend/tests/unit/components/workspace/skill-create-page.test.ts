// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  analyzeDraftMock,
  createDraftMock,
  createSkillMock,
  generateDraftMock,
  installDraftMock,
  pushMock,
} = vi.hoisted(() => ({
  analyzeDraftMock: vi.fn(),
  createDraftMock: vi.fn(),
  pushMock: vi.fn(),
  createSkillMock: vi.fn(),
  generateDraftMock: vi.fn(),
  installDraftMock: vi.fn(),
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
  useAnalyzeSkillDraft: () => ({
    mutate: analyzeDraftMock,
    isPending: false,
  }),
  useCreateSkill: () => ({
    mutate: createSkillMock,
    isPending: false,
  }),
  useCreateSkillDraft: () => ({
    mutate: createDraftMock,
    isPending: false,
  }),
  useGenerateSkillDraft: () => ({
    mutate: generateDraftMock,
    isPending: false,
  }),
  useInstallSkillDraft: () => ({
    mutate: installDraftMock,
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
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`,
  );
  if (!field) {
    throw new Error(`Missing field: ${name}`);
  }
  const valueDescriptor = Object.getOwnPropertyDescriptor(
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    "value",
  );
  const setValue = Reflect.get(
    valueDescriptor ?? {},
    "set",
  ) as
    | ((this: HTMLInputElement | HTMLTextAreaElement, value: string) => void)
    | undefined;
  if (!setValue) {
    throw new Error(`Missing value setter for field: ${name}`);
  }
  act(() => {
    Reflect.apply(setValue, field, [value]);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("SkillCreatePage", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    analyzeDraftMock.mockReset();
    createDraftMock.mockReset();
    pushMock.mockReset();
    createSkillMock.mockReset();
    generateDraftMock.mockReset();
    installDraftMock.mockReset();
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

  test("renders import-first entry cards and switches to script generation", () => {
    ({ container, root } = renderPage());

    expect(container.textContent).toContain("空白创建");
    expect(container.textContent).toContain("导入现成技能");
    expect(container.textContent).toContain("从脚本生成");

    const scriptButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("从脚本生成"),
    );
    expect(scriptButton).toBeTruthy();
    act(() => {
      scriptButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(container.textContent).toContain("上传命令脚本");
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });

  test("uploads scripts, generates a draft, and installs it for the selected work mode", async () => {
    createDraftMock.mockImplementation((_request, options) => {
      options?.onSuccess?.({
        success: true,
        draftId: "draft_abc123",
        mode: "scripts",
        files: [{ path: "convert.py", kind: "python", size: 12 }],
      });
    });
    analyzeDraftMock.mockImplementation((_draftId, options) => {
      options?.onSuccess?.({
        success: true,
        draftId: "draft_abc123",
        evidence: {
          files: [{ path: "convert.py", kind: "python", size: 12 }],
          entryCandidates: [
            { path: "convert.py", confidence: 0.86, reason: "__main__" },
          ],
          commands: [
            {
              path: "convert.py",
              suggestedInvocation: "python scripts/convert.py <input>",
              arguments: [
                { name: "input", required: true, source: "argparse" },
              ],
            },
          ],
          dependencies: [],
          risks: [],
          snippets: [],
        },
      });
    });
    generateDraftMock.mockImplementation((_draftId, options) => {
      options?.onSuccess?.({
        success: true,
        draftId: "draft_abc123",
        evidence: {
          files: [{ path: "convert.py", kind: "python", size: 12 }],
          entryCandidates: [],
          commands: [],
          dependencies: [],
          risks: [],
          snippets: [],
        },
        draft: {
          metadata: {
            id: "convert",
            name: "Convert",
            description: "Convert files",
          },
          skillMarkdown: "---\nname: convert\n---",
          manifestPatch: {
            permissions: {
              workspace: "write",
              network: false,
              exec: "workspace",
              requiresApproval: "on-request",
            },
          },
          questions: [],
          warnings: [],
        },
      });
    });

    ({ container, root } = renderPage());
    const scriptButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("从脚本生成"),
    );
    act(() => {
      scriptButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["print('ok')"], "convert.py", {
      type: "text/x-python",
    });
    Object.defineProperty(input!, "files", {
      configurable: true,
      value: [file],
    });
    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const uploadButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("识别并生成草稿"),
    );
    expect(uploadButton).toBeTruthy();
    await act(async () => {
      uploadButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(createDraftMock).toHaveBeenCalledWith(
      { mode: "scripts", workModeId: "coding", files: [file] },
      expect.any(Object),
    );
    expect(analyzeDraftMock).toHaveBeenCalledWith(
      "draft_abc123",
      expect.any(Object),
    );
    expect(generateDraftMock).toHaveBeenCalledWith(
      "draft_abc123",
      expect.any(Object),
    );
    expect(container.textContent).toContain("Convert");

    const installButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("确认安装"),
    );
    expect(installButton).toBeTruthy();
    await act(async () => {
      installButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(installDraftMock).toHaveBeenCalledWith(
      {
        draftId: "draft_abc123",
        request: expect.objectContaining({
          workModeId: "coding",
          metadata: expect.objectContaining({ id: "convert" }),
          confirmations: ["exec-workspace"],
        }),
      },
      expect.any(Object),
    );
  });

  test("uploads an existing skill package through the package import panel", async () => {
    createDraftMock.mockImplementation((_request, options) => {
      options?.onSuccess?.({
        success: true,
        draftId: "draft_package123",
        mode: "package",
        files: [
          { path: "SKILL.md", kind: "markdown", size: 42 },
          { path: "skill.json", kind: "json", size: 128 },
        ],
      });
    });
    analyzeDraftMock.mockImplementation((_draftId, options) => {
      options?.onSuccess?.({
        success: true,
        draftId: "draft_package123",
        evidence: {
          files: [
            { path: "SKILL.md", kind: "markdown", size: 42 },
            { path: "skill.json", kind: "json", size: 128 },
          ],
          entryCandidates: [{ path: "SKILL.md", confidence: 0.95, reason: "skill package entry" }],
          commands: [],
          dependencies: [],
          risks: [],
          snippets: [],
        },
      });
    });
    generateDraftMock.mockImplementation((_draftId, options) => {
      options?.onSuccess?.({
        success: true,
        draftId: "draft_package123",
        evidence: {
          files: [
            { path: "SKILL.md", kind: "markdown", size: 42 },
            { path: "skill.json", kind: "json", size: 128 },
          ],
          entryCandidates: [],
          commands: [],
          dependencies: [],
          risks: [],
          snippets: [],
        },
        draft: {
          metadata: {
            id: "kk-common",
            name: "KK Common",
            description: "Common KWorks helpers",
          },
          skillMarkdown: "---\nname: kk-common\n---\n# KK Common",
          manifestPatch: {
            assets: [],
            permissions: {
              workspace: "write",
              network: false,
              exec: "workspace",
              requiresApproval: "on-request",
            },
          },
          questions: [],
          warnings: [],
        },
      });
    });

    ({ container, root } = renderPage());
    const packageButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("导入现成技能"),
    );
    act(() => {
      packageButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(container.textContent).toContain("上传技能包");
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["zip"], "kk-common.zip", { type: "application/zip" });
    Object.defineProperty(input!, "files", {
      configurable: true,
      value: [file],
    });
    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const importButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("分析并导入"),
    );
    expect(importButton).toBeTruthy();
    await act(async () => {
      importButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(createDraftMock).toHaveBeenCalledWith(
      { mode: "package", workModeId: "coding", files: [file] },
      expect.any(Object),
    );
    expect(generateDraftMock).toHaveBeenCalledWith(
      "draft_package123",
      expect.any(Object),
    );
    expect(container.textContent).toContain("KK Common");

    const installButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("确认安装"),
    );
    expect(installButton).toBeTruthy();
    await act(async () => {
      installButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(installDraftMock).toHaveBeenCalledWith(
      {
        draftId: "draft_package123",
        request: expect.objectContaining({
          workModeId: "coding",
          metadata: expect.objectContaining({ id: "kk-common" }),
        }),
      },
      expect.any(Object),
    );
  });
});
