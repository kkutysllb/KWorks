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

export interface SkillCreateRequest {
  id: string;
  name: string;
  description: string;
  trigger: string;
  output: string;
  procedure?: string;
  examples?: string[];
  workModeId?: string;
  install?: boolean;
}

export interface SkillCreateResponse {
  success: boolean;
  installed: boolean;
  skill_id: string;
  skill_name: string;
  workModeId?: string;
  root: string;
  message: string;
}

export type SkillDraftMode = "scripts" | "package";

export interface SkillDraftFile {
  path: string;
  kind: string;
  size: number;
}

export interface SkillDraftCreateRequest {
  mode: SkillDraftMode;
  files: File[];
  workModeId?: string;
}

export interface SkillDraftCreateResponse {
  success: boolean;
  draftId: string;
  mode: SkillDraftMode;
  files: SkillDraftFile[];
}

export interface SkillDraftEvidence {
  files: SkillDraftFile[];
  entryCandidates: Array<{
    path: string;
    confidence: number;
    reason: string;
  }>;
  commands: Array<{
    path: string;
    suggestedInvocation: string;
    arguments: Array<{
      name: string;
      required: boolean;
      source: string;
    }>;
  }>;
  dependencies: Array<{
    name: string;
    source: string;
  }>;
  risks: Array<{
    severity: "low" | "medium" | "high" | string;
    kind: string;
    evidence: string;
  }>;
  snippets: Array<{
    path: string;
    label: string;
    text: string;
  }>;
}

export interface GeneratedSkillDraft {
  metadata: {
    id: string;
    name: string;
    description: string;
  };
  skillMarkdown: string;
  manifestPatch: Record<string, unknown>;
  questions: Array<{ field: string; question: string }>;
  warnings: Array<{ severity: string; message: string }>;
}

export interface SkillDraftAnalysisResponse {
  success: boolean;
  draftId: string;
  evidence: SkillDraftEvidence;
}

export interface SkillDraftGenerateResponse extends SkillDraftAnalysisResponse {
  draft: GeneratedSkillDraft;
}

export interface SkillDraftInstallRequest
  extends Omit<GeneratedSkillDraft, "questions" | "warnings"> {
  workModeId?: string;
  confirmations?: string[];
  questions?: GeneratedSkillDraft["questions"];
  warnings?: GeneratedSkillDraft["warnings"];
}
