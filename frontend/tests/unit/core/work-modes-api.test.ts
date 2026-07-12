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
  createWorkMode,
  deleteWorkMode,
  loadWorkModes,
  updateWorkMode,
} from "@/core/skills/api";

describe("work modes API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("normalizes stale built-in task work mode names returned by the API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        defaultModeId: "office",
        lockedSkillIds: ["bootstrap"],
        workModes: [
          {
            id: "office",
            name: "任务模式",
            skills: [],
          },
          {
            id: "coding",
            name: "Coding 模式",
            skills: [],
          },
        ],
      }),
    });

    const result = await loadWorkModes();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19987/api/work-modes",
    );
    expect(result.workModes.map((mode) => [mode.id, mode.name])).toEqual([
      ["office", "日常办公"],
      ["coding", "Coding 模式"],
    ]);
  });

  test("keeps built-in coding mode available when backend omits it", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        defaultModeId: "office",
        lockedSkillIds: [],
        workModes: [
          {
            id: "office",
            name: "日常办公",
            skills: [],
          },
        ],
      }),
    });

    const result = await loadWorkModes();

    expect(result.workModes.map((mode) => [mode.id, mode.name])).toEqual([
      ["office", "日常办公"],
      ["coding", "Coding 模式"],
    ]);
  });

  test("creates, updates, and deletes custom work modes through the gateway", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          workMode: {
            id: "finance-review",
            name: "财经研判",
            description: "分析公告和研报",
            icon: "chart",
            builtin: false,
            editable: true,
            skills: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          workMode: {
            id: "finance-review",
            name: "财经分析",
            description: "分析公告、研报和市场数据",
            icon: "newspaper",
            builtin: false,
            editable: true,
            skills: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    await expect(
      createWorkMode({
        id: "finance-review",
        name: "财经研判",
        description: "分析公告和研报",
        icon: "chart",
      }),
    ).resolves.toMatchObject({ id: "finance-review", name: "财经研判" });
    await expect(
      updateWorkMode("finance-review", {
        name: "财经分析",
        description: "分析公告、研报和市场数据",
        icon: "newspaper",
      }),
    ).resolves.toMatchObject({ id: "finance-review", name: "财经分析" });
    await expect(deleteWorkMode("finance-review")).resolves.toEqual({
      success: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:19987/api/work-modes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "finance-review",
          name: "财经研判",
          description: "分析公告和研报",
          icon: "chart",
        }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:19987/api/work-modes/finance-review",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "财经分析",
          description: "分析公告、研报和市场数据",
          icon: "newspaper",
        }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:19987/api/work-modes/finance-review",
      { method: "DELETE" },
    );
  });

  test("surfaces backend validation details when creating custom work modes", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "description is required" }),
    });

    await expect(
      createWorkMode({
        id: "finance-review",
        name: "财经研判",
        description: "",
        icon: "chart",
      }),
    ).rejects.toThrow("description is required");
  });
});
