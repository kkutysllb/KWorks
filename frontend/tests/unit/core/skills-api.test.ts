import { beforeEach, describe, expect, test, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("@/core/api/fetcher", () => ({
  fetch: fetchMock,
}));

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "http://127.0.0.1:19987",
}));

import {
  analyzeSkillDraft,
  createSkill,
  createSkillDraft,
  generateSkillDraft,
  installSkillDraft,
  loadWorkModeSkills,
} from "@/core/skills/api";

describe("skills API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("creates a skill through the deterministic create endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        installed: true,
        skill_id: "report-search",
        skill_name: "report-search",
        workModeId: "office",
        root: "/tmp/kun/skills/custom/shared/report-search",
        message: "技能 report-search 已创建并绑定到 task",
      }),
    });

    await expect(
      createSkill({
        id: "report-search",
        name: "研报搜索",
        description: "搜索和整理证券研究资料",
        trigger: "用户需要搜索研报或整理证券研究资料",
        output: "Markdown 摘要，包含来源、要点和后续问题",
        procedure: "1. 明确主题和范围\n2. 检索资料",
        workModeId: "office",
      }),
    ).resolves.toMatchObject({
      success: true,
      skill_id: "report-search",
      workModeId: "office",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19987/api/skills/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "report-search",
          name: "研报搜索",
          description: "搜索和整理证券研究资料",
          trigger: "用户需要搜索研报或整理证券研究资料",
          output: "Markdown 摘要，包含来源、要点和后续问题",
          procedure: "1. 明确主题和范围\n2. 检索资料",
          workModeId: "office",
        }),
      },
    );
  });

  test("loads coding work-mode skills through the canonical work-mode endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        skills: [
          {
            id: "code-review",
            name: "Code Review",
            description: "Review code",
            category: "public",
            license: "builtin",
            enabled: true,
            locked: false,
            registered: true,
            status: "registered",
          },
        ],
      }),
    });

    await expect(loadWorkModeSkills("coding")).resolves.toEqual([
      expect.objectContaining({
        id: "code-review",
        enabled: true,
        registered: true,
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19987/api/work-modes/coding/skills",
    );
  });

  test("surfaces backend validation details when creating a skill", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "id is required" }),
    });

    await expect(
      createSkill({
        id: "",
        name: "研报搜索",
        description: "搜索和整理证券研究资料",
        trigger: "用户需要搜索研报或整理证券研究资料",
        output: "Markdown 摘要",
      }),
    ).rejects.toThrow("id is required");
  });

  test("creates a skill draft with multipart uploads", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        draftId: "draft_abc123",
        mode: "scripts",
        files: [{ path: "convert.py", kind: "python", size: 12 }],
      }),
    });

    const file = new File(["print('ok')"], "convert.py", {
      type: "text/x-python",
    });
    await expect(
      createSkillDraft({
        mode: "scripts",
        workModeId: "office",
        files: [file],
      }),
    ).resolves.toMatchObject({
      draftId: "draft_abc123",
      files: [{ path: "convert.py" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19987/api/skills/drafts",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, { body: FormData }];
    expect(init.body.get("mode")).toBe("scripts");
    expect(init.body.get("workModeId")).toBe("office");
    expect(init.body.getAll("files")).toHaveLength(1);
  });

  test("preserves browser directory upload relative paths when creating a skill draft", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        draftId: "draft_pkg123",
        mode: "package",
        files: [{ path: "market-brief/SKILL.md", kind: "markdown", size: 12 }],
      }),
    });

    const file = new File(["# Market Brief"], "SKILL.md", {
      type: "text/markdown",
    }) as File & { webkitRelativePath?: string };
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: "market-brief/SKILL.md",
    });

    await createSkillDraft({
      mode: "package",
      workModeId: "office",
      files: [file],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, { body: FormData }];
    const uploaded = init.body.get("files") as File;
    expect(uploaded.name).toBe("market-brief/SKILL.md");
  });

  test("calls skill draft analyze and generate endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, evidence: { files: [] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          draft: { metadata: { id: "convert" } },
        }),
      });

    await analyzeSkillDraft("draft_abc123");
    await generateSkillDraft("draft_abc123");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:19987/api/skills/drafts/draft_abc123/analyze",
      { method: "POST" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:19987/api/skills/drafts/draft_abc123/generate",
      { method: "POST" },
    );
  });

  test("installs a skill draft with edited metadata and manifest patch", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        installed: true,
        skill_id: "convert",
        workModeId: "office",
        root: "/tmp/kun/skills/custom/shared/convert",
      }),
    });

    await expect(
      installSkillDraft("draft_abc123", {
        workModeId: "office",
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
        confirmations: ["exec-workspace"],
      }),
    ).resolves.toMatchObject({ skill_id: "convert" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19987/api/skills/drafts/draft_abc123/install",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workModeId: "office",
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
          confirmations: ["exec-workspace"],
        }),
      },
    );
  });
});
