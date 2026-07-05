"use client";

import {
  Layers3Icon,
  ShieldCheckIcon,
  SparklesIcon,
  WorkflowIcon,
} from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { WorkModeDialog } from "@/components/workspace/skills/work-mode-dialog";
import { useWorkModes } from "@/core/skills/hooks";
import {
  orderedWorkModes,
  visibleWorkModeSkills,
  workModeDisplayName,
} from "@/core/skills/work-modes";

import { SettingsSection } from "./settings-section";

export function WorkModeSettingsPage() {
  const { workModes, isLoading, error } = useWorkModes();
  const sortedWorkModes = useMemo(
    () => orderedWorkModes(workModes),
    [workModes],
  );

  return (
    <SettingsSection
      title="工作模式"
      description="维护不同任务场景的模式配置，每个模式可以绑定独立的技能组合。"
      icon={<WorkflowIcon className="h-5 w-5 text-amber-500" />}
    >
      <div className="flex w-full flex-col gap-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground max-w-2xl text-sm leading-6">
            工作模式会进入对话运行上下文，用来区分日常办公、Coding
            和用户自定义任务。
          </div>
          {!isLoading && !error && <WorkModeDialog workModes={workModes} />}
        </header>

        {isLoading ? (
          <div className="text-muted-foreground text-sm">加载中...</div>
        ) : error ? (
          <div className="text-destructive text-sm">
            {error.message || "加载工作模式失败"}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {sortedWorkModes.map((mode) => {
              const enabledSkills = visibleWorkModeSkills(mode.skills).length;
              const totalSkills = mode.skills.length;
              return (
                <Item
                  key={mode.id}
                  variant="outline"
                  className="min-w-0 items-start"
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle className="min-w-0">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <SparklesIcon className="text-muted-foreground size-4 shrink-0" />
                        <span className="truncate">
                          {workModeDisplayName(mode)}
                        </span>
                        <Badge variant="secondary" className="gap-1">
                          {mode.builtin ? (
                            <ShieldCheckIcon className="size-3" />
                          ) : (
                            <Layers3Icon className="size-3" />
                          )}
                          {mode.builtin ? "系统内置" : "用户自定义"}
                        </Badge>
                      </span>
                    </ItemTitle>
                    <ItemDescription className="mt-2 min-w-0 space-y-1">
                      <p className="truncate text-xs">{mode.id}</p>
                      <p className="line-clamp-2">
                        {mode.description ?? "暂无说明"}
                      </p>
                      <p className="text-xs">
                        已启用 {enabledSkills} / {totalSkills} 个技能
                      </p>
                    </ItemDescription>
                  </ItemContent>
                </Item>
              );
            })}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
