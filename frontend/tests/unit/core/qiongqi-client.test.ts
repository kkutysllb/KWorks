import { beforeEach, describe, expect, test, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("@/core/api/fetcher", () => ({
  fetch: fetchMock,
}));

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "",
}));

import { isHiddenFromUIMessage } from "@/core/messages/utils";
import {
  qiongqiClient,
  threadRecordToAgentThread,
  threadSummaryToAgentThread,
  turnItemToMessage,
} from "@/core/threads/qiongqi-client";
import type {
  QiongqiThreadRecord,
  QiongqiThreadSummary,
} from "@/core/threads/qiongqi-client";
import type { TurnItem } from "@/core/threads/qiongqi-types";

describe("qiongqi client adapters", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("hides legacy tool catalog drift diagnostic items from the transcript", () => {
    const item: TurnItem = {
      id: "item_turn_1_tool_catalog_changed_fp",
      threadId: "thread-1",
      turnId: "turn-1",
      role: "system",
      status: "failed",
      createdAt: "2026-06-28T00:00:00.000Z",
      finishedAt: "2026-06-28T00:00:00.000Z",
      kind: "error",
      code: "tool_catalog_changed",
      severity: "info",
      message: "Tool catalog changed for this thread",
    };

    const message = turnItemToMessage(item);

    expect(message.type).toBe("system");
    expect(message.content).toBe("");
    expect(isHiddenFromUIMessage(message)).toBe(true);
  });

  test("preserves work mode id when adapting thread summaries", () => {
    const summary: QiongqiThreadSummary = {
      id: "thread-1",
      title: "检查当前项目",
      workspace: "/tmp/project",
      model: "gpt-5",
      workModeId: "coding",
      workModeModuleId: "stock-analysis",
      status: "idle",
      createdAt: "2026-06-28T00:00:00.000Z",
      updatedAt: "2026-06-28T00:00:00.000Z",
    };

    expect(threadSummaryToAgentThread(summary).context?.workModeId).toBe(
      "coding",
    );
    expect(threadSummaryToAgentThread(summary).context?.workspaceRoot).toBe(
      "/tmp/project",
    );
    expect(
      threadSummaryToAgentThread(summary).context?.workModeModuleId,
    ).toBe("stock-analysis");
  });

  test("preserves work mode id when adapting thread records", () => {
    const record: QiongqiThreadRecord = {
      id: "thread-1",
      title: "检查当前项目",
      workspace: "/tmp/project",
      model: "gpt-5",
      workModeId: "coding",
      workModeModuleId: "stock-analysis",
      status: "idle",
      turns: [],
      createdAt: "2026-06-28T00:00:00.000Z",
      updatedAt: "2026-06-28T00:00:00.000Z",
    };

    expect(threadRecordToAgentThread(record).context?.workModeId).toBe(
      "coding",
    );
    expect(threadRecordToAgentThread(record).context?.workspaceRoot).toBe(
      "/tmp/project",
    );
    expect(threadRecordToAgentThread(record).context?.workModeModuleId).toBe(
      "stock-analysis",
    );
  });

  test("adapts user input items into renderable assistant messages", () => {
    const item: TurnItem = {
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

    const message = turnItemToMessage(item);

    expect(message.type).toBe("ai");
    expect(message.content).toBe("");
    expect(message.additional_kwargs?.qiongqi_user_input).toEqual(item);
  });

  test("resolves user input requests through the qiongqi API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        inputId: "in_1",
        status: "submitted",
        answers: [{ id: "target", label: "代码审查", value: "代码审查" }],
      }),
    } as Response);

    await qiongqiClient.resolveUserInput("in_1", {
      answers: [{ id: "target", label: "代码审查", value: "代码审查" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/user-inputs/in_1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          answers: [{ id: "target", label: "代码审查", value: "代码审查" }],
        }),
      }),
    );
  });
});
