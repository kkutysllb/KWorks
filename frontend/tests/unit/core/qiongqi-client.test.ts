import { describe, expect, test } from "vitest";

import { isHiddenFromUIMessage } from "@/core/messages/utils";
import {
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
  });

  test("preserves work mode id when adapting thread records", () => {
    const record: QiongqiThreadRecord = {
      id: "thread-1",
      title: "检查当前项目",
      workspace: "/tmp/project",
      model: "gpt-5",
      workModeId: "coding",
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
  });
});
