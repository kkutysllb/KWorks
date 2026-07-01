import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type {
  CreateProjectRequest,
  CreateWorktreeRequest,
  CodingLatestReview,
  CodingReview,
  CodingReviewApplyFixRequest,
  CodingReviewApplyFixResult,
  CodingReviewRequest,
  CodingSkillDetail,
  CodingSkill,
  DeliveryStagesResponse,
  DiscardProjectFileChangeRequest,
  DiscardProjectFileChangeResult,
  FileContent,
  FileEntry,
  Project,
  ProjectEnvironment,
  ProjectDiff,
  ProjectGitCommitRequest,
  ProjectGitCommitResult,
  ProjectGitPushResult,
  ProjectStageState,
  QiongqiChangesList,
  QiongqiEventsList,
  QiongqiSession,
  QiongqiRoiReportsList,
  QiongqiRoiSummary,
  RemoveWorktreeRequest,
  SetCodingSkillEnabledRequest,
  SetStageRequest,
  WorktreeCreateResult,
  WorktreeInfo,
  WorktreeRemoveResult,
} from "./types";

type WorkModeSkillDto = {
  id: string;
  name: string;
  description: string;
  category?: string;
  family?: string;
  license?: string;
  enabled: boolean;
  locked?: boolean;
  registered?: boolean;
  status?: string;
  builtin?: boolean;
  editable?: boolean;
  deletable?: boolean;
  root?: string;
  version?: string;
  validationError?: string;
  commands?: unknown[];
  permissions?: Record<string, unknown>;
  contributions?: Record<string, unknown>;
  triggers?: {
    promptPatterns?: unknown;
  };
  allowedTools?: unknown;
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${getBackendBaseURL()}/api/projects`);
  if (!res.ok) throw new Error(`Failed to load projects: ${res.statusText}`);
  const data = (await res.json()) as { projects: Project[] };
  return data.projects;
}

/** Error thrown when ``GET /api/projects/{id}`` returns a non-OK response.
 *
 * The ``status`` field lets callers distinguish a genuine 404 (project deleted
 * or never existed) from transient network/server failures, so the UI can
 * decide whether to redirect away or show a retry affordance.
 */
export class ProjectFetchError extends Error {
  readonly status: number;
  constructor(projectId: string, status: number, statusText: string) {
    super(
      status === 404
        ? `Project '${projectId}' not found`
        : `Failed to load project (${status} ${statusText})`,
    );
    this.name = "ProjectFetchError";
    this.status = status;
  }
}

export async function getProject(projectId: string): Promise<Project> {
  const res = await fetch(`${getBackendBaseURL()}/api/projects/${projectId}`);
  if (!res.ok) {
    throw new ProjectFetchError(projectId, res.status, res.statusText);
  }
  return res.json() as Promise<Project>;
}

export async function createProject(
  request: CreateProjectRequest,
): Promise<Project> {
  const res = await fetch(`${getBackendBaseURL()}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to create project: ${res.statusText}`,
    );
  }
  return res.json() as Promise<Project>;
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await fetch(`${getBackendBaseURL()}/api/projects/${projectId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete project: ${res.statusText}`);
}

// ---------------------------------------------------------------------------
// Worktrees
// ---------------------------------------------------------------------------

export async function listWorktrees(
  projectId: string,
): Promise<WorktreeInfo[]> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/worktrees`,
  );
  if (!res.ok) throw new Error(`Failed to list worktrees: ${res.statusText}`);
  const data = (await res.json()) as { worktrees: WorktreeInfo[] };
  return data.worktrees;
}

export async function createWorktree(
  projectId: string,
  request: CreateWorktreeRequest,
): Promise<WorktreeCreateResult> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/worktrees`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to create worktree: ${res.statusText}`,
    );
  }
  return res.json() as Promise<WorktreeCreateResult>;
}

export async function removeWorktree(
  projectId: string,
  request: RemoveWorktreeRequest,
): Promise<WorktreeRemoveResult> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/worktrees`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to remove worktree: ${res.statusText}`,
    );
  }
  return res.json() as Promise<WorktreeRemoveResult>;
}

// ---------------------------------------------------------------------------
// File browsing
// ---------------------------------------------------------------------------

export async function listFiles(
  projectId: string,
  subpath = ".",
): Promise<FileEntry[]> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/files?path=${encodeURIComponent(subpath)}`,
  );
  if (!res.ok) throw new Error(`Failed to list files: ${res.statusText}`);
  const data = (await res.json()) as { entries: FileEntry[] };
  return data.entries;
}

export async function readFile(
  projectId: string,
  subpath: string,
): Promise<FileContent> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/file?path=${encodeURIComponent(subpath)}`,
  );
  if (!res.ok) throw new Error(`Failed to read file: ${res.statusText}`);
  return res.json() as Promise<FileContent>;
}

export async function getProjectDiff(projectId: string): Promise<ProjectDiff> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/diff`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load project diff: ${res.statusText}`,
    );
  }
  return res.json() as Promise<ProjectDiff>;
}

export async function getProjectEnvironment(
  projectId: string,
): Promise<ProjectEnvironment> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/environment`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load project environment: ${res.statusText}`,
    );
  }
  return res.json() as Promise<ProjectEnvironment>;
}

export async function discardProjectFileChange(
  projectId: string,
  request: DiscardProjectFileChangeRequest,
): Promise<DiscardProjectFileChangeResult> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/diff/discard`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to discard file change: ${res.statusText}`,
    );
  }
  return res.json() as Promise<DiscardProjectFileChangeResult>;
}

export async function gitCommitProject(
  projectId: string,
  request: ProjectGitCommitRequest,
): Promise<ProjectGitCommitResult> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/git/commit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Failed to commit project: ${res.statusText}`);
  }
  return res.json() as Promise<ProjectGitCommitResult>;
}

export async function gitPushProject(
  projectId: string,
): Promise<ProjectGitPushResult> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/projects/${projectId}/git/push`,
    {
      method: "POST",
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Failed to push project: ${res.statusText}`);
  }
  return res.json() as Promise<ProjectGitPushResult>;
}

// ---------------------------------------------------------------------------
// Coding Agent inspector
// ---------------------------------------------------------------------------

export async function getCodingSession(
  threadId: string,
): Promise<QiongqiSession> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/sessions/${encodeURIComponent(threadId)}`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load coding session: ${res.statusText}`,
    );
  }
  return res.json() as Promise<QiongqiSession>;
}

export async function listCodingSessionEvents(
  threadId: string,
): Promise<QiongqiEventsList> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/sessions/${encodeURIComponent(threadId)}/events?limit=100`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load coding events: ${res.statusText}`,
    );
  }
  return res.json() as Promise<QiongqiEventsList>;
}

export async function listCodingSessionChanges(
  threadId: string,
): Promise<QiongqiChangesList> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/sessions/${encodeURIComponent(threadId)}/changes`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load coding changes: ${res.statusText}`,
    );
  }
  return res.json() as Promise<QiongqiChangesList>;
}

export async function runCodingReview(
  request: CodingReviewRequest,
): Promise<CodingReview> {
  const res = await fetch(`${getBackendBaseURL()}/api/coding/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to run coding review: ${res.statusText}`,
    );
  }
  return res.json() as Promise<CodingReview>;
}

export async function getLatestCodingReview(
  threadId: string,
): Promise<CodingLatestReview> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/sessions/${encodeURIComponent(threadId)}/review`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load coding review: ${res.statusText}`,
    );
  }
  return res.json() as Promise<CodingLatestReview>;
}

export async function applyCodingReviewFix(
  request: CodingReviewApplyFixRequest,
): Promise<CodingReviewApplyFixResult> {
  const res = await fetch(`${getBackendBaseURL()}/api/coding/reviews/fixes/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to apply coding review fix: ${res.statusText}`,
    );
  }
  return res.json() as Promise<CodingReviewApplyFixResult>;
}

export async function getCodingRoiSummary(
  threadId: string,
): Promise<QiongqiRoiSummary> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/sessions/${encodeURIComponent(threadId)}/roi/summary`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load ROI summary: ${res.statusText}`,
    );
  }
  return res.json() as Promise<QiongqiRoiSummary>;
}

export async function listCodingRoiReports(
  threadId: string,
): Promise<QiongqiRoiReportsList> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/sessions/${encodeURIComponent(threadId)}/roi`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load ROI reports: ${res.statusText}`,
    );
  }
  return res.json() as Promise<QiongqiRoiReportsList>;
}

export async function listCodingSkills(
  projectRoot: string | null | undefined,
): Promise<CodingSkill[]> {
  void projectRoot;
  const res = await fetch(`${getBackendBaseURL()}/api/work-modes/coding/skills`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load coding skills: ${res.statusText}`,
    );
  }
  const data = (await res.json()) as { skills: WorkModeSkillDto[] };
  return (data.skills ?? []).map(codingSkillFromWorkModeSkill);
}

export async function setCodingSkillEnabled(
  skillId: string,
  request: SetCodingSkillEnabledRequest,
): Promise<CodingSkillDetail> {
  void request.project_root;
  void request.scope;
  const res = await fetch(
    `${getBackendBaseURL()}/api/work-modes/coding/skills/${encodeURIComponent(skillId)}`,
    { method: request.enabled ? "PUT" : "DELETE" },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to update coding skill: ${res.statusText}`,
    );
  }
  const data = (await res.json()) as { workMode?: { skills?: WorkModeSkillDto[] } };
  const skill = data.workMode?.skills?.find((item) => item.id === skillId);
  return {
    skill: codingSkillFromWorkModeSkill(
      skill ?? {
        id: skillId,
        name: skillId,
        description: "",
        enabled: request.enabled,
      },
    ),
    instructions: "",
  };
}

function codingSkillFromWorkModeSkill(skill: WorkModeSkillDto): CodingSkill {
  const manifestErrors = skill.validationError ? [skill.validationError] : [];
  const activationKeywords = stringList(skill.triggers?.promptPatterns);
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category ?? "",
    family: skill.family,
    license: skill.license ?? "",
    scope: skill.builtin || skill.locked ? "global" : "project",
    legacy: false,
    activation_keywords: activationKeywords,
    always_activate: false,
    allowed_tools: stringList(skill.allowedTools),
    permissions: skill.permissions ?? null,
    skill_file: skill.root ? `${skill.root}/SKILL.md` : "",
    enabled: skill.enabled,
    manifest_errors: manifestErrors,
    commands: commandList(skill.commands),
    ui: null,
    locked: skill.locked,
    registered: skill.registered,
    status: skill.status,
    builtin: skill.builtin,
    editable: skill.editable,
    deletable: skill.deletable,
    root: skill.root,
    version: skill.version,
    validationError: skill.validationError,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function commandList(value: unknown): Array<Record<string, string>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, string> => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        return Object.values(item).every((entry) => typeof entry === "string");
      })
    : [];
}

// ---------------------------------------------------------------------------
// Delivery stage tracking
// ---------------------------------------------------------------------------

export async function getDeliveryStages(): Promise<DeliveryStagesResponse> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/delivery-stages`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load delivery stages: ${res.statusText}`,
    );
  }
  return res.json() as Promise<DeliveryStagesResponse>;
}

export async function getProjectStage(
  projectRoot: string,
): Promise<ProjectStageState> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/stage?project_root=${encodeURIComponent(projectRoot)}`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to load project stage: ${res.statusText}`,
    );
  }
  return res.json() as Promise<ProjectStageState>;
}

export async function setProjectStage(
  projectRoot: string,
  request: SetStageRequest,
): Promise<ProjectStageState> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/stage?project_root=${encodeURIComponent(projectRoot)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to set project stage: ${res.statusText}`,
    );
  }
  return res.json() as Promise<ProjectStageState>;
}

export async function acceptStageSuggestion(
  projectRoot: string,
): Promise<ProjectStageState> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/stage/suggestion/accept?project_root=${encodeURIComponent(projectRoot)}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to accept stage suggestion: ${res.statusText}`,
    );
  }
  return res.json() as Promise<ProjectStageState>;
}

export async function dismissStageSuggestion(
  projectRoot: string,
): Promise<ProjectStageState> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/coding/stage/suggestion/dismiss?project_root=${encodeURIComponent(projectRoot)}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(
      err.detail ?? `Failed to dismiss stage suggestion: ${res.statusText}`,
    );
  }
  return res.json() as Promise<ProjectStageState>;
}
