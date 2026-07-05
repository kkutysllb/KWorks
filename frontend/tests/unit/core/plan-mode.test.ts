import { describe, expect, test } from "vitest";

import {
  getCreatePlanCompletionKey,
  isCreatePlanCompletionEvent,
  isCreatePlanToolEnd,
} from "@/core/threads/plan-mode";

describe("plan mode helpers", () => {
  test("recognizes successful create_plan tool-end callbacks", () => {
    expect(
      isCreatePlanToolEnd({
        name: "create_plan",
        data: {
          plan_id: "plan_1",
          relative_path: ".qiongqisdd/plan/report.md",
        },
      }),
    ).toBe(true);
  });

  test("ignores failed or unrelated tool-end callbacks", () => {
    expect(
      isCreatePlanToolEnd({
        name: "write",
        data: { relative_path: "report.md" },
      }),
    ).toBe(false);
    expect(
      isCreatePlanToolEnd({
        name: "create_plan",
        data: { error: "missing markdown" },
      }),
    ).toBe(false);
  });

  test("recognizes successful qiongqi create_plan completion events", () => {
    expect(
      isCreatePlanCompletionEvent({
        kind: "tool_call_finished",
        item: {
          kind: "tool_result",
          toolName: "create_plan",
          isError: false,
          output: {
            plan_id: "plan_1",
            relative_path: ".qiongqisdd/plan/report.md",
          },
        },
      }),
    ).toBe(true);
  });

  test("extracts a stable key for successful create_plan completions", () => {
    const toolEnd = {
      name: "create_plan",
      data: {
        plan_id: "plan_1",
        relative_path: ".qiongqisdd/plan/report.md",
      },
    };
    const qiongqiEvent = {
      kind: "tool_call_finished",
      item: {
        kind: "tool_result",
        toolName: "create_plan",
        isError: false,
        output: {
          plan_id: "plan_1",
          relative_path: ".qiongqisdd/plan/report.md",
        },
      },
    };

    expect(getCreatePlanCompletionKey(toolEnd)).toBe(
      "plan_1:.qiongqisdd/plan/report.md",
    );
    expect(getCreatePlanCompletionKey(qiongqiEvent)).toBe(
      "plan_1:.qiongqisdd/plan/report.md",
    );
    expect(getCreatePlanCompletionKey({ name: "write", data: {} })).toBeNull();
  });
});
