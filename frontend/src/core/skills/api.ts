import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type {
  Skill,
  SkillCreateRequest,
  SkillCreateResponse,
  WorkMode,
  WorkModeSkill,
  WorkModesResponse,
  WorkModeUpdateRequest,
  WorkModeWriteRequest,
} from "./type";
import { withSystemWorkModes, workModeDisplayName } from "./work-modes";

export async function loadSkills() {
  const skills = await fetch(`${getBackendBaseURL()}/api/skills`);
  const json = await skills.json();
  return json.skills as Skill[];
}

export async function loadWorkModes(): Promise<WorkModesResponse> {
  const response = await fetch(`${getBackendBaseURL()}/api/work-modes`);
  if (!response.ok) {
    throw new Error(`Failed to load work modes (${response.status})`);
  }
  const json = (await response.json()) as Partial<WorkModesResponse>;
  return {
    defaultModeId: json.defaultModeId ?? "task",
    lockedSkillIds: json.lockedSkillIds ?? [],
    workModes: withSystemWorkModes(
      (json.workModes ?? []).map((mode) => ({
        ...mode,
        skills: mode.skills ?? [],
        name: workModeDisplayName(mode),
      })),
    ),
  };
}

export async function loadWorkModeSkills(
  workModeId: string,
): Promise<WorkModeSkill[]> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/work-modes/${encodeURIComponent(workModeId)}/skills`,
  );
  if (!response.ok) {
    throw new Error(`Failed to load work mode skills (${response.status})`);
  }
  const json = (await response.json()) as { skills?: WorkModeSkill[] };
  return json.skills ?? [];
}

export async function createWorkMode(
  request: WorkModeWriteRequest,
): Promise<WorkMode> {
  const response = await fetch(`${getBackendBaseURL()}/api/work-modes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(
      (await responseDetail(response)) ??
        `Failed to create work mode (${response.status})`,
    );
  }
  const json = (await response.json()) as { workMode: WorkMode };
  return json.workMode;
}

export async function updateWorkMode(
  workModeId: string,
  request: WorkModeUpdateRequest,
): Promise<WorkMode> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/work-modes/${encodeURIComponent(workModeId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new Error(
      (await responseDetail(response)) ??
        `Failed to update work mode (${response.status})`,
    );
  }
  const json = (await response.json()) as { workMode: WorkMode };
  return json.workMode;
}

export async function deleteWorkMode(
  workModeId: string,
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/work-modes/${encodeURIComponent(workModeId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete work mode (${response.status})`);
  }
  return response.json() as Promise<{ success: boolean }>;
}

async function responseDetail(response: Response): Promise<string | undefined> {
  const body = (await response.json().catch(() => null)) as {
    detail?: unknown;
    message?: unknown;
  } | null;
  const detail = body?.detail ?? body?.message;
  return typeof detail === "string" && detail.trim()
    ? detail.trim()
    : undefined;
}

export async function addSkillToWorkMode(
  workModeId: string,
  skillId: string,
): Promise<WorkMode> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/work-modes/${encodeURIComponent(workModeId)}/skills/${encodeURIComponent(skillId)}`,
    { method: "PUT" },
  );
  if (!response.ok) {
    throw new Error(`Failed to add skill to work mode (${response.status})`);
  }
  const json = (await response.json()) as { workMode: WorkMode };
  return json.workMode;
}

export async function removeSkillFromWorkMode(
  workModeId: string,
  skillId: string,
): Promise<WorkMode> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/work-modes/${encodeURIComponent(workModeId)}/skills/${encodeURIComponent(skillId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to remove skill from work mode (${response.status})`,
    );
  }
  const json = (await response.json()) as { workMode: WorkMode };
  return json.workMode;
}

export async function enableSkill(skillName: string, enabled: boolean) {
  const response = await fetch(
    `${getBackendBaseURL()}/api/skills/${skillName}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled,
      }),
    },
  );
  return response.json();
}

export async function registerSkill(skillName: string) {
  const response = await fetch(
    `${getBackendBaseURL()}/api/skills/${encodeURIComponent(skillName)}/register`,
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error(`Failed to register skill (${response.status})`);
  }
  return response.json();
}

export async function unregisterSkill(skillName: string) {
  const response = await fetch(
    `${getBackendBaseURL()}/api/skills/${encodeURIComponent(skillName)}/unregister`,
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error(`Failed to unregister skill (${response.status})`);
  }
  return response.json();
}

export async function deleteSkill(skillName: string) {
  const response = await fetch(
    `${getBackendBaseURL()}/api/skills/${encodeURIComponent(skillName)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete skill (${response.status})`);
  }
  return response.json();
}

export async function createSkill(
  request: SkillCreateRequest,
): Promise<SkillCreateResponse> {
  const response = await fetch(`${getBackendBaseURL()}/api/skills/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(
      (await responseDetail(response)) ??
        `Failed to create skill (${response.status})`,
    );
  }
  return response.json() as Promise<SkillCreateResponse>;
}

export interface InstallSkillRequest {
  thread_id: string;
  path: string;
  workModeId?: string;
}

export interface InstallSkillResponse {
  success: boolean;
  skill_name: string;
  message: string;
}

export async function installSkill(
  request: InstallSkillRequest,
): Promise<InstallSkillResponse> {
  const response = await fetch(`${getBackendBaseURL()}/api/skills/install`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    // Handle HTTP error responses (4xx, 5xx)
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      errorData.detail ?? `HTTP ${response.status}: ${response.statusText}`;
    return {
      success: false,
      skill_name: "",
      message: errorMessage,
    };
  }

  return response.json();
}
