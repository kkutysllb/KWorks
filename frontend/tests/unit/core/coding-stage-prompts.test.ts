import { describe, expect, test } from "vitest";

import { buildCodingStagePrompt } from "@/core/coding/stage-prompts";
import type { DeliveryStage, ProjectStageState } from "@/core/projects/types";

const implementationStage: DeliveryStage = {
  id: "implementation",
  title: "Implementation",
  goal: "Apply focused code changes with the project workspace and coding skills active.",
  recommended_skills: ["implement", "tdd", "debugging", "frontend-engineering"],
  suggested_prompt:
    "Implement the planned change, keep edits scoped, and update tests alongside the code.",
  next_stage_id: "review",
};

const stageState: ProjectStageState = {
  project_root: "/repo/app",
  current_stage: "implementation",
  stage_history: [],
  pending_suggestion: null,
  updated_at: "2026-07-13T00:00:00.000Z",
};

describe("buildCodingStagePrompt", () => {
  test("adds compact hidden context for the active coding workflow stage", () => {
    const prompt = buildCodingStagePrompt({
      userText: "修复打包后的 review 面板",
      projectRoot: "/repo/app",
      stage: implementationStage,
      stageState,
    });

    expect(prompt).toContain("Coding Workbench 场景上下文");
    expect(prompt).toContain("当前阶段: implementation - Implementation");
    expect(prompt).toContain("项目根目录: /repo/app");
    expect(prompt).toContain(
      "优先激活技能: implement, tdd, debugging, frontend-engineering",
    );
    expect(prompt).toContain("Implement the planned change");
    expect(prompt).toContain("用户原始请求:");
    expect(prompt).toContain("修复打包后的 review 面板");
    expect(prompt).toContain("中间过程的用户可见正文和最终回答必须使用中文");
  });

  test("returns the user text unchanged when no active stage exists", () => {
    expect(
      buildCodingStagePrompt({
        userText: "解释这个报错",
        projectRoot: "/repo/app",
        stage: null,
        stageState: { ...stageState, current_stage: null },
      }),
    ).toBe("解释这个报错");
  });
});
