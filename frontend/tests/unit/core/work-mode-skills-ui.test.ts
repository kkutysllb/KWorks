import { describe, expect, test } from "vitest";

import type { WorkMode, WorkModeSkill } from "@/core/skills/type";
import {
  buildWorkModeSkillViews,
  orderedWorkModes,
  visibleWorkModeSkills,
  workModeDisplayName,
} from "@/core/skills/work-modes";

describe("work mode skills UI", () => {
  test("only renders skills enabled in the selected work mode", () => {
    const skills: WorkModeSkill[] = [
      {
        id: "bootstrap",
        name: "bootstrap",
        description: "Required setup",
        category: "public",
        license: "builtin",
        enabled: true,
        locked: true,
      },
      {
        id: "coding-review",
        name: "coding-review",
        description: "Review code",
        category: "public",
        license: "builtin",
        enabled: true,
      },
      {
        id: "deep-research",
        name: "deep-research",
        description: "Research task",
        category: "public",
        license: "builtin",
        enabled: false,
      },
    ];

    expect(visibleWorkModeSkills(skills).map((skill) => skill.id)).toEqual([
      "bootstrap",
      "coding-review",
    ]);
  });

  test("groups enabled readonly skills into builtin and per-work-mode tabs", () => {
    const workModes: WorkMode[] = [
      {
        id: "office",
        name: "任务模式",
        skills: [
          skill("bootstrap", { locked: true }),
          skill("data-analysis"),
          skill("code-review", { enabled: false }),
        ],
      },
      {
        id: "coding",
        name: "Coding 模式",
        skills: [
          skill("bootstrap", { locked: true }),
          skill("code-review"),
          skill("data-analysis", { enabled: false }),
        ],
      },
    ];

    const views = buildWorkModeSkillViews(workModes);

    expect(views.map((view) => [view.id, view.label])).toEqual([
      ["builtin", "内置"],
      ["office", "日常办公"],
      ["coding", "Coding 模式"],
    ]);
    expect(
      views.find((view) => view.id === "builtin")?.skills.map(skillId),
    ).toEqual(["bootstrap"]);
    expect(
      views.find((view) => view.id === "office")?.skills.map(skillId),
    ).toEqual(["data-analysis"]);
    expect(
      views.find((view) => view.id === "coding")?.skills.map(skillId),
    ).toEqual(["code-review"]);
    expect(views.every((view) => view.readonly)).toBe(true);
  });

  test("normalizes the built-in task work mode display name", () => {
    expect(workModeDisplayName({ id: "office", name: "任务模式" })).toBe(
      "日常办公",
    );
  });

  test("orders daily office before coding even when API data is reversed", () => {
    const workModes: WorkMode[] = [
      { id: "coding", name: "Coding 模式", skills: [] },
      { id: "finance-review", name: "财经研判", skills: [] },
      { id: "office", name: "日常办公", skills: [] },
    ];

    expect(orderedWorkModes(workModes).map((mode) => mode.id)).toEqual([
      "office",
      "coding",
      "finance-review",
    ]);
    expect(buildWorkModeSkillViews(workModes).map((view) => view.id)).toEqual([
      "builtin",
      "office",
      "coding",
      "finance-review",
    ]);
  });
});

function skill(
  id: string,
  overrides: Partial<WorkModeSkill> = {},
): WorkModeSkill {
  return {
    id,
    name: id,
    description: `${id} description`,
    category: "public",
    license: "builtin",
    enabled: true,
    ...overrides,
  };
}

function skillId(skill: WorkModeSkill): string {
  return skill.id;
}
