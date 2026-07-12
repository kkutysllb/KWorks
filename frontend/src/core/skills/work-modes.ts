import type { WorkMode, WorkModeSkill } from "./type";

export const BUILTIN_SKILL_VIEW_ID = "builtin";
export const SYSTEM_WORK_MODES: readonly WorkMode[] = [
  {
    id: "office",
    name: "日常办公",
    description: "日常办公任务",
    icon: "zap",
    builtin: true,
    editable: false,
    skills: [],
  },
  {
    id: "coding",
    name: "Coding 模式",
    description: "代码开发任务",
    icon: "code",
    builtin: true,
    editable: false,
    skills: [],
  },
  {
    id: "finance",
    name: "金融量化",
    description: "金融财经分析",
    icon: "chart",
    builtin: true,
    editable: false,
    skills: [],
  },
];

export interface WorkModeSkillView {
  id: string;
  label: string;
  workModeId?: string;
  readonly?: boolean;
  skills: WorkModeSkill[];
}

export function visibleWorkModeSkills(
  skills: readonly WorkModeSkill[] | undefined,
): WorkModeSkill[] {
  return (skills ?? []).filter((skill) => skill.enabled);
}

export function workModeDisplayName(mode: Pick<WorkMode, "id" | "name">) {
  if (mode.id === "office") return "日常办公";
  if (mode.id === "finance") return "金融量化";
  return mode.name || mode.id;
}

export function workModeDisplayNameById(
  workModeId: string | null | undefined,
  workModes?: readonly Pick<WorkMode, "id" | "name">[],
): string | null {
  const raw = workModeId?.trim();
  if (!raw) return null;
  // Legacy alias: "task" was renamed to "office".
  const id = raw === "task" ? "office" : raw;
  const mode =
    workModes?.find((candidate) => candidate.id === id) ??
    SYSTEM_WORK_MODES.find((candidate) => candidate.id === id);
  return mode ? workModeDisplayName(mode) : "自定义工作模式";
}

function workModeOrder(mode: Pick<WorkMode, "id">): number {
  if (mode.id === "office") return 0;
  if (mode.id === "coding") return 1;
  if (mode.id === "finance") return 2;
  return 100;
}

export function orderedWorkModes<Mode extends Pick<WorkMode, "id">>(
  workModes: readonly Mode[],
): Mode[] {
  return [...workModes].sort((left, right) => {
    const orderDiff = workModeOrder(left) - workModeOrder(right);
    if (orderDiff !== 0) return orderDiff;
    return left.id.localeCompare(right.id);
  });
}

export function withSystemWorkModes(
  workModes: readonly WorkMode[],
): WorkMode[] {
  const byId = new Map(workModes.map((mode) => [mode.id, mode]));
  for (const systemMode of SYSTEM_WORK_MODES) {
    if (!byId.has(systemMode.id)) {
      byId.set(systemMode.id, { ...systemMode, skills: [] });
    }
  }
  return orderedWorkModes([...byId.values()]);
}

export function buildWorkModeSkillViews(
  workModes: readonly WorkMode[],
): WorkModeSkillView[] {
  const builtinSkills = new Map<string, WorkModeSkill>();

  for (const mode of workModes) {
    for (const skill of visibleWorkModeSkills(mode.skills)) {
      if (skill.locked) {
        builtinSkills.set(skill.id ?? skill.name, skill);
      }
    }
  }

  return [
    {
      id: BUILTIN_SKILL_VIEW_ID,
      label: "内置",
      readonly: true,
      skills: [...builtinSkills.values()],
    },
    ...orderedWorkModes(workModes).map((mode) => ({
      id: mode.id,
      label: workModeDisplayName(mode),
      workModeId: mode.id,
      readonly: true,
      skills: visibleWorkModeSkills(mode.skills).filter(
        (skill) => !skill.locked,
      ),
    })),
  ];
}
