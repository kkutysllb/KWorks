import { describe, expect, test } from "vitest";

import { groupHistoryTasksByWorkMode } from "@/components/workspace/history-tasks";
import { buildProjectTaskSummary } from "@/components/workspace/project-tasks";
import type { AgentThread } from "@/core/threads/types";

describe("history task grouping", () => {
  test("groups history tasks by work mode with daily office first", () => {
    const groups = groupHistoryTasksByWorkMode(
      [
        {
          thread_id: "coding-1",
          updated_at: "2026-06-02T10:00:00Z",
          context: { workModeId: "coding" },
          values: { title: "Fix sidebar" },
        },
        {
          thread_id: "legacy-1",
          updated_at: "2026-06-03T10:00:00Z",
          values: { title: "Legacy task" },
        },
        {
          thread_id: "task-1",
          updated_at: "2026-06-01T10:00:00Z",
          context: { workModeId: "task" },
          values: { title: "Write report" },
        },
        {
          thread_id: "research-1",
          updated_at: "2026-06-04T10:00:00Z",
          context: { workModeId: "research" },
          values: { title: "Research task" },
        },
      ],
      [{ id: "research", name: "研究模式" }],
    );

    expect(groups.map((group) => [group.id, group.label, group.count])).toEqual(
      [
        ["task", "日常办公", 2],
        ["coding", "Coding 模式", 1],
        ["research", "研究模式", 1],
      ],
    );
    expect(groups[0]?.threads.map((thread) => thread.thread_id)).toEqual([
      "legacy-1",
      "task-1",
    ]);
  });

  test("groups sidebar project tasks by registered project and current workspace", () => {
    const summary = buildProjectTaskSummary({
      currentWorkspaceRoot: "/repo/kworks/",
      projects: [
        {
          id: "p-kworks",
          name: "KWorks",
          path: "/repo/kworks",
        },
        {
          id: "p-quant",
          name: "stock-quant",
          path: "/repo/stock-quant",
        },
      ],
      threads: [
        {
          thread_id: "k-running",
          status: "busy",
          created_at: "2026-07-01T09:00:00Z",
          updated_at: "2026-07-01T09:20:00Z",
          metadata: null,
          context: {
            thread_id: "k-running",
            model_name: "deepseek-v4",
            thinking_enabled: false,
            is_plan_mode: false,
            subagent_enabled: false,
            projectId: "p-kworks",
            workspaceRoot: "/repo/kworks",
            workModeId: "coding",
          },
          values: { title: "全面分析当前项目", messages: [], artifacts: [] },
          interrupts: {},
        },
        {
          thread_id: "q-done",
          status: "idle",
          created_at: "2026-06-30T16:00:00Z",
          updated_at: "2026-06-30T16:25:00Z",
          metadata: null,
          context: {
            thread_id: "q-done",
            model_name: "deepseek-v4",
            thinking_enabled: false,
            is_plan_mode: false,
            subagent_enabled: false,
            workspaceRoot: "/repo/stock-quant/",
            workModeId: "coding",
          },
          values: { title: "市场因子复盘", messages: [], artifacts: [] },
          interrupts: {},
        },
        {
          thread_id: "daily",
          status: "idle",
          created_at: "2026-07-01T09:00:00Z",
          updated_at: "2026-07-01T09:12:00Z",
          metadata: null,
          context: {
            thread_id: "daily",
            model_name: "deepseek-v4",
            thinking_enabled: false,
            is_plan_mode: false,
            subagent_enabled: false,
            workModeId: "task",
          },
          values: { title: "你好", messages: [], artifacts: [] },
          interrupts: {},
        },
      ] satisfies AgentThread[],
    });

    expect(summary.buckets.map((bucket) => bucket.project.id)).toEqual([
      "p-kworks",
      "p-quant",
    ]);
    expect(summary.buckets[0]).toMatchObject({
      isCurrent: true,
      runningCount: 1,
      latestUpdatedAt: "2026-07-01T09:20:00Z",
    });
    expect(summary.buckets[0]?.threads.map((thread) => thread.thread_id)).toEqual([
      "k-running",
    ]);
    expect(summary.unassignedThreads.map((thread) => thread.thread_id)).toEqual([
      "daily",
    ]);
  });
});
