import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { threadTitlePath } from "@/core/threads/api";

const repoRoot = resolve(__dirname, "../../..");

describe("threads api", () => {
  test("encodes thread id for title lookup path", () => {
    expect(threadTitlePath("thread/with space")).toBe(
      "/api/threads/thread%2Fwith%20space",
    );
  });

  test("skills core exposes work mode API contracts and hooks", () => {
    const types = readFileSync(
      resolve(repoRoot, "src/core/skills/type.ts"),
      "utf8",
    );
    const api = readFileSync(
      resolve(repoRoot, "src/core/skills/api.ts"),
      "utf8",
    );
    const hooks = readFileSync(
      resolve(repoRoot, "src/core/skills/hooks.ts"),
      "utf8",
    );

    expect(types).toContain("export interface WorkModeSkill extends Skill");
    expect(types).toContain("export interface WorkMode");
    expect(types).toContain("locked?: boolean");

    expect(api).toContain("export async function loadWorkModes");
    expect(api).toContain("export async function loadWorkModeSkills");
    expect(api).toContain("export async function addSkillToWorkMode");
    expect(api).toContain("export async function removeSkillFromWorkMode");
    expect(api).toContain("workModeId?: string");
    expect(api).toContain("/api/work-modes");
    expect(api).toContain('method: "PUT"');
    expect(api).toContain('method: "DELETE"');

    expect(hooks).toContain("export function useWorkModes");
    expect(hooks).toContain("export function useWorkModeSkills");
    expect(hooks).toContain("export function useAddSkillToWorkMode");
    expect(hooks).toContain("export function useRemoveSkillFromWorkMode");
    expect(hooks).toContain('queryKey: ["work-modes"]');
    expect(hooks).toContain('queryKey: ["work-mode-skills", workModeId]');
  });

  test("qiongqi client and stream propagate product work mode id", () => {
    const client = readFileSync(
      resolve(repoRoot, "src/core/threads/qiongqi-client.ts"),
      "utf8",
    );
    const stream = readFileSync(
      resolve(repoRoot, "src/core/threads/qiongqi-stream.ts"),
      "utf8",
    );
    const types = readFileSync(
      resolve(repoRoot, "src/core/threads/types.ts"),
      "utf8",
    );

    expect(types).toContain("workModeId?: string");
    expect(client).toContain("workModeId?: string");
    expect(stream).toContain("workModeIdFromContext");
    expect(stream).toContain(
      "const requestedWorkModeId = workModeIdFromContext(context);",
    );
    expect(stream).toContain("workModeId: requestedWorkModeId");
    expect(stream).toContain("workModeId: turnWorkModeId");
  });
});
