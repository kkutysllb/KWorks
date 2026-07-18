"use client";

import {
  FilePenLineIcon,
  MoreHorizontalIcon,
  PlugIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemTitle,
  ItemContent,
  ItemDescription,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/core/i18n/hooks";
import {
  useAddSkillToWorkMode,
  useDeleteSkill,
  useRemoveSkillFromWorkMode,
  useRegisterSkill,
  useUnregisterSkill,
  useWorkModes,
} from "@/core/skills/hooks";
import type { Skill, WorkMode, WorkModeSkill } from "@/core/skills/type";
import {
  buildWorkModeSkillViews,
  BUILTIN_SKILL_VIEW_ID,
} from "@/core/skills/work-modes";

import { WorkModeDialog } from "../skills/work-mode-dialog";

import { SettingsSection } from "./settings-section";

export function SkillSettingsPage({ onClose }: { onClose?: () => void } = {}) {
  const { t } = useI18n();
  const { workModes, defaultModeId, isLoading, error } = useWorkModes();
  return (
    <SettingsSection
      title={t.settings.skills.title}
      description={t.settings.skills.description}
      icon={<SparklesIcon className="h-5 w-5 text-violet-500" />}
    >
      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t.common.loading}</div>
      ) : error ? (
        <div>Error: {error.message}</div>
      ) : (
        <SkillSettingsList
          defaultModeId={defaultModeId}
          workModes={workModes}
          onClose={onClose}
        />
      )}
    </SettingsSection>
  );
}

function SkillSettingsList({
  defaultModeId,
  workModes,
  onClose,
}: {
  defaultModeId: string;
  workModes: WorkMode[];
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedSkillViewId, setSelectedSkillViewId] = useState(defaultModeId);
  const skillViews = useMemo(
    () => buildWorkModeSkillViews(workModes),
    [workModes],
  );
  const selectedSkillView =
    skillViews.find((view) => view.id === selectedSkillViewId) ??
    skillViews.find((view) => view.id === defaultModeId) ??
    skillViews.find((view) => view.id === BUILTIN_SKILL_VIEW_ID) ??
    skillViews[0];
  const activeSkillViewId = selectedSkillView?.id ?? selectedSkillViewId;
  const activeWorkModeId = selectedSkillView?.workModeId ?? defaultModeId;
  const isReadonlyView = selectedSkillView?.readonly ?? false;
  const skills = selectedSkillView?.skills ?? [];
  const { mutate: addSkillToWorkMode } = useAddSkillToWorkMode();
  const { mutate: removeSkillFromWorkMode } = useRemoveSkillFromWorkMode();
  const { mutate: registerSkill } = useRegisterSkill();
  const { mutate: unregisterSkill } = useUnregisterSkill();
  const { mutate: deleteSkill } = useDeleteSkill();
  const hasMutableWorkMode = Boolean(selectedSkillView?.workModeId) && !isReadonlyView;
  const handleCreateSkill = () => {
    onClose?.();
    const params = new URLSearchParams({
      workModeId: activeWorkModeId,
    });
    router.push(`/workspace/skills/create?${params.toString()}`);
  };
  const openSkillTask = (skill: string, intent: string, target?: Skill) => {
    onClose?.();
    const params = new URLSearchParams({
      mode: "skill",
      skill,
      intent,
    });
    const targetId = target?.id ?? target?.name;
    if (targetId) params.set("target", targetId);
    params.set("workModeId", activeWorkModeId);
    router.push(`/workspace/chats/new?${params.toString()}`);
  };
  const toggleModeSkill = (skill: WorkModeSkill, enabled: boolean) => {
    if (!hasMutableWorkMode) return;
    const skillId = skill.id ?? skill.name;
    const mutation = enabled ? addSkillToWorkMode : removeSkillFromWorkMode;
    mutation(
      { workModeId: activeWorkModeId, skillId },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "更新工作模式技能失败",
          ),
      },
    );
  };
  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-x-auto">
          <Tabs
            value={activeSkillViewId}
            onValueChange={setSelectedSkillViewId}
          >
            <TabsList variant="line">
              {skillViews.map((view) => (
                <TabsTrigger value={view.id} key={view.id}>
                  {view.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openSkillTask("find-skills", "find")}
          >
            <SearchIcon className="size-4" />
            查找技能
          </Button>
          <WorkModeDialog
            workModes={workModes}
            onSelectWorkMode={setSelectedSkillViewId}
          />
          <Button size="sm" onClick={handleCreateSkill}>
            <SparklesIcon className="size-4" />
            {t.settings.skills.createSkill}
          </Button>
        </div>
      </header>
      {skills.length === 0 && <EmptySkill onCreateSkill={handleCreateSkill} />}
      {skills.length > 0 &&
        skills.map((skill) => (
          <Item
            className="w-full"
            variant="outline"
            key={skill.id ?? skill.name}
          >
            <ItemContent>
              <ItemTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <span>{skill.name}</span>
                  <SkillStatusBadge skill={skill} />
                  {skill.builtin && (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheckIcon className="size-3" />
                      内置
                    </Badge>
                  )}
                  {skill.locked && (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheckIcon className="size-3" />
                      公共内置
                    </Badge>
                  )}
                  <Badge variant="outline">{skill.category}</Badge>
                </div>
              </ItemTitle>
              <ItemDescription className="mt-1 space-y-1">
                <p className="line-clamp-3">
                  {skill.description ?? "暂无描述"}
                </p>
                <p className="truncate text-xs">
                  {skill.root ?? "未绑定本地目录"}
                </p>
                {skill.validationError && (
                  <p className="text-destructive text-xs">
                    {skill.validationError}
                  </p>
                )}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="gap-2">
              <Switch
                checked={skill.enabled}
                disabled={
                  isReadonlyView ||
                  (skill.locked ?? false)
                }
                onCheckedChange={(checked) => toggleModeSkill(skill, checked)}
              />
              {!isReadonlyView && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-8">
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        registerSkill(skill.id ?? skill.name, {
                          onError: (err) =>
                            toast.error(
                              err instanceof Error ? err.message : "注册技能失败",
                            ),
                        })
                      }
                    >
                      <PlugIcon className="size-4" />
                      注册
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        openSkillTask("skill-manage", "repair", skill)
                      }
                    >
                      <PlugIcon className="size-4" />
                      对话修复
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        openSkillTask("skill-creator", "edit", skill)
                      }
                      disabled={!skill.editable}
                    >
                      <FilePenLineIcon className="size-4" />
                      对话编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        unregisterSkill(skill.id ?? skill.name, {
                          onError: (err) =>
                            toast.error(
                              err instanceof Error ? err.message : "注销技能失败",
                            ),
                        })
                      }
                      disabled={skill.locked}
                    >
                      <PlugIcon className="size-4" />
                      注销
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toggleModeSkill(skill, false)}
                      disabled={(skill.locked ?? false) || !skill.enabled}
                      className="text-destructive"
                    >
                      <Trash2Icon className="size-4" />
                      从当前模式移除
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        deleteSkill(skill.id ?? skill.name, {
                          onError: (err) =>
                            toast.error(
                              err instanceof Error ? err.message : "删除技能失败",
                            ),
                        })
                      }
                      disabled={(skill.locked ?? false) || !skill.deletable}
                      className="text-destructive"
                    >
                      <Trash2Icon className="size-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </ItemActions>
          </Item>
        ))}
    </div>
  );
}

function SkillStatusBadge({ skill }: { skill: Skill }) {
  if (skill.status === "invalid") {
    return <Badge variant="destructive">异常</Badge>;
  }
  if (!skill.enabled || skill.status === "disabled") {
    return <Badge variant="secondary">停用</Badge>;
  }
  return <Badge variant="default">已注册</Badge>;
}

function EmptySkill({ onCreateSkill }: { onCreateSkill: () => void }) {
  const { t } = useI18n();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>
        <EmptyTitle>{t.settings.skills.emptyTitle}</EmptyTitle>
        <EmptyDescription>
          {t.settings.skills.emptyDescription}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreateSkill}>{t.settings.skills.emptyButton}</Button>
      </EmptyContent>
    </Empty>
  );
}
