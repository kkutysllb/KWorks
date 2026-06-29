export interface Skill {
  id?: string;
  name: string;
  description: string;
  category: string;
  family?:
    | "qiongqi-coding"
    | "kworks-management"
    | "kworks-public"
    | "user-custom"
    | "user"
    | string;
  license: string;
  enabled: boolean;
  registered?: boolean;
  status?: "registered" | "disabled" | "invalid" | "deleted" | string;
  builtin?: boolean;
  editable?: boolean;
  deletable?: boolean;
  root?: string;
  version?: string;
  validationError?: string;
  commands?: unknown[];
}

export interface WorkModeSkill extends Skill {
  id: string;
  locked?: boolean;
}

export interface WorkMode {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  builtin?: boolean;
  editable?: boolean;
  skills: WorkModeSkill[];
}

export interface WorkModesResponse {
  defaultModeId: string;
  lockedSkillIds: string[];
  workModes: WorkMode[];
}

export interface WorkModeWriteRequest {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export type WorkModeUpdateRequest = Partial<WorkModeWriteRequest>;
