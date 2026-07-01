import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("coding inspector API", () => {
  test("projects core exposes qiongqi events, roi, and coding skills APIs", () => {
    const api = readFileSync(
      resolve(repoRoot, "src/core/projects/api.ts"),
      "utf8",
    );
    const hooks = readFileSync(
      resolve(repoRoot, "src/core/projects/hooks.ts"),
      "utf8",
    );
    const skillHooks = readFileSync(
      resolve(repoRoot, "src/core/skills/hooks.ts"),
      "utf8",
    );
    const skillApi = readFileSync(
      resolve(repoRoot, "src/core/skills/api.ts"),
      "utf8",
    );
    const types = readFileSync(
      resolve(repoRoot, "src/core/projects/types.ts"),
      "utf8",
    );

    expect(types).toContain("export interface QiongqiEvent");
    expect(types).toContain("export interface QiongqiSessionSnapshot");
    expect(types).toContain("export interface QiongqiChange");
    expect(types).toContain("export interface CodingReview");
    expect(types).toContain("export interface CodingReviewFinding");
    expect(types).toContain("export interface CodingReviewApplyFixRequest");
    expect(types).toContain('"project_diff" | "task_changes" | "all" | "pr"');
    expect(types).toContain("export interface QiongqiRoiSummary");
    expect(types).toContain("export interface QiongqiRoiDerived");
    expect(types).toContain("estimated_saved_tokens");
    expect(types).toContain("saving_ratio");
    expect(types).toContain("export interface CodingSkill");
    expect(types).toContain("export interface SetCodingSkillEnabledRequest");
    expect(types).not.toContain("export interface CodingSkillWriteRequest");
    expect(types).not.toContain("export interface CodingSkillDeleteResult");
    expect(api).toContain("export async function getCodingSession");
    expect(api).toContain(
      "/api/coding/sessions/${encodeURIComponent(threadId)}",
    );
    expect(api).toContain("export async function listCodingSessionEvents");
    expect(api).toContain("/api/coding/sessions/");
    expect(api).toContain("/events?limit=100");
    expect(api).toContain("export async function listCodingSessionChanges");
    expect(api).toContain("/changes");
    expect(api).toContain("export async function runCodingReview");
    expect(api).toContain("/api/coding/reviews");
    expect(api).toContain("export async function getLatestCodingReview");
    expect(api).toContain("/review");
    expect(api).toContain("export async function applyCodingReviewFix");
    expect(api).toContain("/api/coding/reviews/fixes/apply");
    expect(api).toContain("export async function getCodingRoiSummary");
    expect(api).toContain("/roi/summary");
    expect(api).toContain("Promise<QiongqiRoiSummary>");
    expect(api).toContain("export async function listCodingSkills");
    expect(api).toContain("/api/work-modes/coding/skills");
    expect(api).not.toContain("/api/coding/skills");
    expect(api).not.toContain("export async function getCodingSkill");
    expect(api).not.toContain("export async function createCodingSkill");
    expect(api).not.toContain("export async function updateCodingSkill");
    expect(api).not.toContain("export async function deleteCodingSkill");
    expect(api).toContain("export async function setCodingSkillEnabled");
    expect(api).toContain('method: request.enabled ? "PUT" : "DELETE"');
    expect(hooks).toContain("export function useCodingSession");
    expect(hooks).toContain("export function useCodingSessionEvents");
    expect(hooks).toContain("export function useCodingSessionChanges");
    expect(hooks).toContain("export function useLatestCodingReview");
    expect(hooks).toContain("export function useRunCodingReview");
    expect(hooks).toContain("export function useApplyCodingReviewFix");
    expect(hooks).toContain("export function useCodingRoiSummary");
    expect(hooks).toContain("export function useCodingSkills");
    expect(hooks).toContain("export function useSetCodingSkillEnabled");
    expect(hooks).not.toContain("export function useCodingSkillDetail");
    expect(hooks).not.toContain("export function useCreateCodingSkill");
    expect(hooks).not.toContain("export function useUpdateCodingSkill");
    expect(hooks).not.toContain("export function useDeleteCodingSkill");
    expect(hooks).toContain(
      'queryKey: ["coding", "sessions", threadId, "session"]',
    );
    expect(hooks).toContain(
      'queryKey: ["coding", "sessions", threadId, "events"]',
    );
    expect(hooks).toContain(
      'queryKey: ["coding", "sessions", threadId, "changes"]',
    );
    expect(hooks).toContain(
      'queryKey: ["coding", "sessions", threadId, "review"]',
    );
    expect(hooks).toContain("runCodingReview(request)");
    expect(hooks).toContain("applyCodingReviewFix(request)");
    expect(hooks).toContain(
      'queryKey: ["projects", projectId, "file", result.file]',
    );
    expect(hooks).toContain(
      'queryKey: ["coding", "sessions", threadId, "roi", "summary"]',
    );
    expect(hooks).toContain('queryKey: ["coding", "skills"]');
    expect(hooks).toContain("setCodingSkillEnabled(skillId, request)");
    expect(hooks).toContain('queryKey: ["work-modes"]');
    expect(hooks).toContain('queryKey: ["work-mode-skills", "coding"]');
    expect(hooks).not.toContain("createCodingSkill(request)");
    expect(hooks).not.toContain("updateCodingSkill(skillId, request)");
    expect(hooks).not.toContain("deleteCodingSkill(skillId, projectRoot)");

    expect(skillApi).toContain("export async function loadWorkModes");
    expect(skillApi).toContain("export async function loadWorkModeSkills");
    expect(skillApi).toContain("export async function addSkillToWorkMode");
    expect(skillApi).toContain("export async function removeSkillFromWorkMode");
    expect(skillApi).toContain("/api/work-modes");
    expect(skillHooks).toContain("export function useWorkModes");
    expect(skillHooks).toContain("export function useWorkModeSkills");
    expect(skillHooks).toContain("export function useAddSkillToWorkMode");
    expect(skillHooks).toContain("export function useRemoveSkillFromWorkMode");
    expect(skillHooks).toContain('queryKey: ["work-modes"]');
    expect(skillHooks).toContain('queryKey: ["work-mode-skills", workModeId]');
    expect(skillHooks).toContain("invalidateWorkModeSkillQueries");
  });
});
