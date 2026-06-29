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

import { createSkill } from "@/core/skills/api";

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
        workModeId: "task",
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
        workModeId: "task",
      }),
    ).resolves.toMatchObject({
      success: true,
      skill_id: "report-search",
      workModeId: "task",
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
          workModeId: "task",
        }),
      },
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
});
