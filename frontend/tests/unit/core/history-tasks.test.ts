import { describe, expect, test } from "vitest";

import { groupHistoryTasksByWorkMode } from "@/components/workspace/history-tasks";

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
});
