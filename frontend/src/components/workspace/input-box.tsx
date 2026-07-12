"use client";

import type { ChatStatus } from "ai";
import {
  CheckIcon,
  Code2Icon,
  CpuIcon,
  FolderIcon,
  GraduationCapIcon,
  LightbulbIcon,
  PaperclipIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ComponentProps,
  type ReactNode,
} from "react";

import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { pickDirectory } from "@/core/desktop";
import { useI18n } from "@/core/i18n/hooks";
import { activateModel } from "@/core/models/api";
import { useModels } from "@/core/models/hooks";
import type { Model } from "@/core/models/types";
import { useWorkModes } from "@/core/skills/hooks";
import type { WorkMode } from "@/core/skills/type";
import {
  orderedWorkModes,
  SYSTEM_WORK_MODES,
  withSystemWorkModes,
  workModeDisplayName,
} from "@/core/skills/work-modes";
import type { AgentThreadContext } from "@/core/threads";
import { useThreads } from "@/core/threads/hooks";
import { cn } from "@/lib/utils";

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "../ai-elements/model-selector";

import { ArtifactResultStrip } from "./artifacts/artifact-result-strip";
import { PendingQueueStrip } from "./input/pending-queue-strip";
import { useThread } from "./messages/context";
import {
  getWorkspaceRootDisplayName,
  isSelectedWorkspaceRoot,
  QiongQiRoiStrip,
} from "./qiongqi-roi-strip";
import { Tooltip } from "./tooltip";

type TaskMode = "agent" | "plan";
type ExecutionProfile = "fast" | "balanced" | "deep";
type CollaborationPolicy = "single" | "auto";
type QiongQiContext = Omit<
  AgentThreadContext,
  "thread_id" | "is_plan_mode" | "thinking_enabled" | "subagent_enabled"
> & {
  model_name?: string;
  taskMode?: TaskMode;
  executionProfile?: ExecutionProfile;
  collaborationPolicy?: CollaborationPolicy;
  workModeId?: string;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  workspaceRoot?: string;
  approvalPolicy?: "auto" | "manual" | "never";
};

export type InputBoxSubmitContext = QiongQiContext;

export function getModelDisplayName(
  model: Pick<Model, "display_name" | "name" | "model"> | undefined,
): string {
  return (
    firstNonEmpty(
      model?.display_name?.trim(),
      model?.name?.trim(),
      model?.model?.trim(),
    ) ?? ""
  );
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value.length > 0);
}

export function getModelSelectorTriggerState({
  selectedModel,
  isLoading,
  loadingLabel,
  fallbackLabel,
}: {
  selectedModel: Pick<Model, "display_name" | "name" | "model"> | undefined;
  isLoading: boolean;
  loadingLabel: string;
  fallbackLabel: string;
}): { label: string; disabled: boolean } {
  const modelLabel = getModelDisplayName(selectedModel);
  if (modelLabel) {
    return { label: modelLabel, disabled: false };
  }
  if (isLoading) {
    return { label: loadingLabel, disabled: true };
  }
  return { label: fallbackLabel, disabled: true };
}

export function resolveSelectedModel(
  models: Model[],
  contextModelName: string | undefined,
): Model | undefined {
  if (models.length === 0) return undefined;
  return (
    models.find((m) => m.name === contextModelName) ??
    models.find((m) => m.active)
  );
}

function getResolvedExecutionProfile(
  profile: ExecutionProfile | undefined,
  supportsThinking: boolean,
): ExecutionProfile {
  if (!supportsThinking && profile !== "fast") {
    return "fast";
  }
  if (profile) {
    return profile;
  }
  return supportsThinking ? "balanced" : "fast";
}

function getReasoningEffortForProfile(
  profile: ExecutionProfile,
): "minimal" | "low" | "medium" | "high" {
  if (profile === "deep") return "high";
  if (profile === "balanced") return "medium";
  return "minimal";
}

export function resolveWorkModeId(
  workModes: WorkMode[],
  preferred: string | undefined,
): string {
  const trimmed = preferred?.trim();
  if (trimmed && workModes.some((mode) => mode.id === trimmed)) {
    return trimmed;
  }
  if (trimmed && !SYSTEM_WORK_MODES.some((mode) => mode.id === trimmed)) {
    return trimmed;
  }
  return workModes[0]?.id ?? "office";
}

function contextForWorkMode(
  context: QiongQiContext,
  workModeId: string,
  supportThinking: boolean,
): QiongQiContext {
  return {
    ...context,
    workModeId,
    taskMode: context.taskMode === "plan" ? "plan" : "agent",
    executionProfile:
      workModeId === "coding"
        ? getResolvedExecutionProfile("deep", supportThinking)
        : (context.executionProfile ??
          getResolvedExecutionProfile(undefined, supportThinking)),
  };
}

function getWorkModeIcon(
  workMode: Pick<WorkMode, "id" | "icon">,
): ComponentType<{ className?: string }> {
  const icon = workMode.icon?.toLowerCase() ?? "";
  if (workMode.id === "coding" || icon.includes("code")) {
    return Code2Icon;
  }
  return ZapIcon;
}

export function InputBox({
  className,
  disabled,
  autoFocus,
  status = "ready",
  context,
  isNewThread,
  threadId,
  initialValue,
  initialWorkModeId = "office",
  onContextChange,
  onSubmit,
  onStop,
  pendingQueue,
  onSteerPending,
  onRemovePending,
  onPreviewResultFile,
  ...props
}: Omit<ComponentProps<typeof PromptInput>, "onSubmit"> & {
  status?: ChatStatus;
  disabled?: boolean;
  context: QiongQiContext;
  isNewThread?: boolean;
  threadId: string;
  initialValue?: string;
  initialWorkModeId?: string;
  onContextChange?: (context: QiongQiContext) => void;
  onSubmit?: (
    message: PromptInputMessage,
    context: InputBoxSubmitContext,
  ) => void;
  onStop?: () => void;
  pendingQueue?: Array<{ id: string; text: string; createdAt: number }>;
  onSteerPending?: (id: string) => void;
  onRemovePending?: (id: string) => void;
  /** When provided, clicking preview on a result file routes here instead of
   *  the shared ArtifactsContext (used by the coding workbench to open the
   *  file in its own results panel). */
  onPreviewResultFile?: (filepath: string) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const { models, isLoading: isModelsLoading } = useModels();
  const { defaultModeId, workModes: loadedWorkModes } = useWorkModes();
  const { data: historyThreads } = useThreads();
  const { thread } = useThread();
  const promptRootRef = useRef<HTMLDivElement | null>(null);
  const workModes = orderedWorkModes(
    loadedWorkModes.length > 0
      ? withSystemWorkModes(loadedWorkModes)
      : [...SYSTEM_WORK_MODES],
  );
  const workModeId = resolveWorkModeId(
    workModes,
    context.workModeId ?? initialWorkModeId ?? defaultModeId,
  );

  // While streaming, the submit button becomes a Stop button only when the
  // composer is empty. With text present it stays a Send button (the message
  // is queued by the stream hook and does NOT interrupt the running turn).
  const promptController = usePromptInputController();
  const hasComposerText = promptController.textInput.value.trim().length > 0;
  const submitStatus =
    status === "streaming" && !hasComposerText ? "streaming" : status;

  useEffect(() => {
    if (models.length === 0) {
      return;
    }
    const currentModel = resolveSelectedModel(models, context.model_name);
    if (!currentModel) return;
    const supportsThinking = currentModel.supports_thinking ?? false;
    const nextModelName = currentModel.name;
    const nextProfile = getResolvedExecutionProfile(
      context.executionProfile,
      supportsThinking,
    );

    if (
      context.model_name === nextModelName &&
      context.executionProfile === nextProfile
    ) {
      return;
    }

    onContextChange?.({
      ...context,
      model_name: nextModelName,
      taskMode: context.taskMode === "plan" ? "plan" : "agent",
      executionProfile: nextProfile,
      collaborationPolicy: context.collaborationPolicy ?? "single",
      workModeId,
    });
  }, [context, models, onContextChange, workModeId]);

  const selectedModel = useMemo(() => {
    if (models.length === 0) {
      return undefined;
    }
    return resolveSelectedModel(models, context.model_name);
  }, [context.model_name, models]);
  const modelSelectorTrigger = useMemo(
    () =>
      getModelSelectorTriggerState({
        selectedModel,
        isLoading: isModelsLoading,
        loadingLabel: t.common.loading,
        fallbackLabel: "未配置模型",
      }),
    [isModelsLoading, selectedModel, t.common.loading],
  );

  const resolvedModelName = selectedModel?.name;
  const modelReady = Boolean(resolvedModelName);

  const supportThinking = useMemo(
    () => selectedModel?.supports_thinking ?? false,
    [selectedModel],
  );

  useEffect(() => {
    if (context.workModeId === workModeId) {
      return;
    }
    onContextChange?.(contextForWorkMode(context, workModeId, supportThinking));
  }, [context, onContextChange, supportThinking, workModeId]);

  const workspaceRootLabel = getWorkspaceRootDisplayName(context.workspaceRoot);
  const selectedWorkMode = workModes.find((mode) => mode.id === workModeId);
  const selectedWorkModeLabel = selectedWorkMode
    ? workModeDisplayName(selectedWorkMode)
    : workModeId;
  const showSkillCreateBindingHint =
    isNewThread &&
    searchParams.get("mode") === "skill" &&
    searchParams.get("intent") === "create";
  const workspaceHistory = useMemo(() => {
    const values = new Set<string>();
    if (isSelectedWorkspaceRoot(context.workspaceRoot)) {
      values.add(context.workspaceRoot.trim());
    }
    for (const historyThread of historyThreads ?? []) {
      const value = historyThread.context?.workspaceRoot;
      if (isSelectedWorkspaceRoot(value)) {
        values.add(value.trim());
      }
    }
    for (const message of thread.messages) {
      const value = Reflect.get(
        message.additional_kwargs ?? {},
        "workspaceRoot",
      );
      if (isSelectedWorkspaceRoot(value)) {
        values.add(value.trim());
      }
    }
    return Array.from(values).slice(0, 6);
  }, [context.workspaceRoot, historyThreads, thread.messages]);

  const handleModelSelect = useCallback(
    (model_name: string) => {
      const model = models.find((m) => m.name === model_name);
      if (!model) {
        return;
      }
      void activateModel(model_name).catch((error) => {
        console.error("Failed to activate QiongQi runtime model", error);
      });
      onContextChange?.({
        ...context,
        model_name,
        executionProfile: getResolvedExecutionProfile(
          context.executionProfile,
          model.supports_thinking ?? false,
        ),
        reasoning_effort: context.reasoning_effort,
      });
      setModelDialogOpen(false);
    },
    [onContextChange, context, models],
  );

  const handleTaskModeSelect = useCallback(
    (taskMode: TaskMode) => {
      onContextChange?.({
        ...context,
        taskMode,
      });
    },
    [onContextChange, context],
  );

  const handleExecutionProfileSelect = useCallback(
    (executionProfile: ExecutionProfile) => {
      const resolvedProfile = getResolvedExecutionProfile(
        executionProfile,
        supportThinking,
      );
      onContextChange?.({
        ...context,
        executionProfile: resolvedProfile,
        reasoning_effort: getReasoningEffortForProfile(resolvedProfile),
      });
    },
    [onContextChange, context, supportThinking],
  );

  const handleCollaborationPolicySelect = useCallback(
    (collaborationPolicy: CollaborationPolicy) => {
      onContextChange?.({
        ...context,
        collaborationPolicy,
      });
    },
    [onContextChange, context],
  );

  const handleWorkspaceRootSelect = useCallback(
    (workspaceRoot: string | undefined) => {
      onContextChange?.({
        ...context,
        workspaceRoot,
      });
    },
    [context, onContextChange],
  );

  const handleWorkspaceRootPick = useCallback(async () => {
    const picked = await pickDirectory({ title: "选择工作空间" });
    if (!picked) return;
    handleWorkspaceRootSelect(picked);
  }, [handleWorkspaceRootSelect]);

  const handleWorkModeSelect = useCallback(
    (nextWorkModeId: string) => {
      if (isNewThread && nextWorkModeId === "coding") {
        onContextChange?.(
          contextForWorkMode(context, nextWorkModeId, supportThinking),
        );
        router.push("/workspace/coding");
        return;
      }
      onContextChange?.(
        contextForWorkMode(context, nextWorkModeId, supportThinking),
      );
    },
    [context, isNewThread, onContextChange, router, supportThinking],
  );

  const handleApprovalPolicySelect = useCallback(
    (approvalPolicy: QiongQiContext["approvalPolicy"]) => {
      onContextChange?.({
        ...context,
        approvalPolicy,
      });
    },
    [context, onContextChange],
  );

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      // While a turn is streaming:
      //  - with text in the composer → send (the stream hook queues it and
      //    does NOT interrupt the running task; the queue auto-drains on
      //    turn finish, or the user can "steer" it immediately).
      //  - with an empty composer → act as the Stop button.
      if (status === "streaming" && !message.text.trim()) {
        onStop?.();
        return;
      }
      if (!message.text.trim()) {
        if (status === "streaming") {
          onStop?.();
        }
        return;
      }
      if (!modelReady) {
        setModelDialogOpen(true);
        return;
      }

      if (resolvedModelName && context.model_name !== resolvedModelName) {
        const nextContext: QiongQiContext = {
          ...context,
          model_name: resolvedModelName,
          executionProfile: getResolvedExecutionProfile(
            context.executionProfile,
            selectedModel?.supports_thinking ?? false,
          ),
          taskMode: context.taskMode === "plan" ? "plan" : "agent",
          collaborationPolicy: context.collaborationPolicy ?? "single",
          workModeId,
        };
        onContextChange?.(nextContext);
        setTimeout(() => onSubmit?.(message, nextContext), 0);
        return;
      }

      onSubmit?.(
        message,
        contextForWorkMode(context, workModeId, supportThinking),
      );
    },
    [
      context,
      onContextChange,
      onSubmit,
      onStop,
      resolvedModelName,
      modelReady,
      selectedModel?.supports_thinking,
      status,
      supportThinking,
      workModeId,
    ],
  );

  return (
    <div
      ref={promptRootRef}
      className={cn("relative flex flex-col", isNewThread ? "gap-8" : "gap-4")}
    >
      {isNewThread &&
        searchParams.get("mode") !== "skill" &&
        searchParams.get("mode") !== "cron" && (
          <WorkModeTabs
            mode={workModeId}
            workModes={workModes}
            onModeSelect={handleWorkModeSelect}
          />
        )}
      {showSkillCreateBindingHint && (
        <div className="border-border/70 bg-muted/45 text-muted-foreground flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs">
          <span className="min-w-0 truncate">
            新技能将自动绑定到当前工作模式：
            <span className="text-foreground font-medium">
              {selectedWorkModeLabel}
            </span>
          </span>
          <span className="bg-background text-muted-foreground shrink-0 rounded-md border px-2 py-0.5">
            当前模式
          </span>
        </div>
      )}
      <ArtifactResultStrip
        status={status}
        threadId={threadId}
        onPreview={onPreviewResultFile}
      />
      {pendingQueue && pendingQueue.length > 0 && onSteerPending && onRemovePending && (
        <PendingQueueStrip
          entries={pendingQueue}
          onSteer={onSteerPending}
          onRemove={onRemovePending}
        />
      )}
      <PromptInput
        className={cn(
          "bg-background/85 rounded-2xl backdrop-blur-sm transition-all duration-300 ease-out *:data-[slot='input-group']:overflow-visible *:data-[slot='input-group']:rounded-2xl",
          className,
        )}
        disabled={disabled}
        globalDrop
        multiple
        onSubmit={handleSubmit}
        {...props}
      >
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
        <PromptInputBody className="absolute top-0 right-0 left-0 z-3">
          <PromptInputTextarea
            className={cn("size-full")}
            disabled={disabled}
            placeholder={t.inputBox.placeholder}
            autoFocus={autoFocus}
            defaultValue={initialValue}
          />
        </PromptInputBody>
        <PromptInputFooter className="flex flex-wrap items-end gap-2 pt-2 pb-2">
          <PromptInputTools className="min-w-0 flex-1 flex-wrap">
            <WorkspaceRootMenu
              workspaceRoot={context.workspaceRoot}
              workspaceRootLabel={workspaceRootLabel}
              workspaceHistory={workspaceHistory}
              onPickDirectory={handleWorkspaceRootPick}
              onWorkspaceRootSelect={handleWorkspaceRootSelect}
            />
            {/* TODO: Add more connectors here
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger className="px-2!" />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments
                label={t.inputBox.addAttachments}
              />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu> */}
            <AddAttachmentsButton className="px-2!" />
            <QiongQiExecutionModeMenu
              context={context}
              supportThinking={supportThinking}
              onExecutionProfileSelect={handleExecutionProfileSelect}
              onApprovalPolicySelect={handleApprovalPolicySelect}
            />
            <QiongQiTaskModeMenu
              taskMode={context.taskMode === "plan" ? "plan" : "agent"}
              onTaskModeSelect={handleTaskModeSelect}
            />
            <QiongQiCollaborationMenu
              collaborationPolicy={context.collaborationPolicy ?? "single"}
              onCollaborationPolicySelect={handleCollaborationPolicySelect}
            />
          </PromptInputTools>
          <PromptInputTools className="ml-auto shrink-0">
            <ModelSelector
              open={modelDialogOpen}
              onOpenChange={setModelDialogOpen}
            >
              <ModelSelectorTrigger asChild>
                <span className="inline-flex">
                  <PromptInputButton
                    aria-label={t.sidebar.models}
                    className="max-w-[14rem] gap-1.5 px-2! sm:max-w-[16rem]"
                    disabled={modelSelectorTrigger.disabled}
                  >
                    <CpuIcon className="text-muted-foreground size-3 shrink-0" />
                    <div className="flex min-w-0 flex-col items-start text-left">
                      <ModelSelectorName className="text-xs font-normal">
                        {modelSelectorTrigger.label}
                      </ModelSelectorName>
                    </div>
                  </PromptInputButton>
                </span>
              </ModelSelectorTrigger>
              <ModelSelectorContent>
                <ModelSelectorInput placeholder={t.inputBox.searchModels} />
                <ModelSelectorList>
                  <ModelSelectorEmpty>
                    <div className="text-muted-foreground py-6 text-center text-sm">
                      暂未配置模型，请先在设置中添加模型。
                    </div>
                  </ModelSelectorEmpty>
                  {models.map((m) => (
                    <ModelSelectorItem
                      key={m.name}
                      value={m.name}
                      onSelect={() => handleModelSelect(m.name)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <ModelSelectorName>
                          {getModelDisplayName(m)}
                        </ModelSelectorName>
                        <span className="text-muted-foreground truncate text-[10px]">
                          {m.model}
                        </span>
                      </div>
                      {m.name === context.model_name ? (
                        <CheckIcon className="ml-auto size-4" />
                      ) : (
                        <div className="ml-auto size-4" />
                      )}
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorList>
              </ModelSelectorContent>
            </ModelSelector>
            <PromptInputSubmit
              className="rounded-full"
              // Boolean OR is intentional: either condition disables submit.
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              disabled={disabled || !modelReady}
              variant="outline"
              status={submitStatus}
            />
          </PromptInputTools>
        </PromptInputFooter>
        <div className="order-last w-full px-3 pb-2">
          <QiongQiRoiStrip
            className="border-border/60 bg-muted/35 h-5 rounded-lg border shadow-none"
            messages={thread.messages}
            threadId={threadId}
          />
        </div>
      </PromptInput>
    </div>
  );
}

function AddAttachmentsButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const attachments = usePromptInputAttachments();
  return (
    <Tooltip content={t.inputBox.addAttachments}>
      <PromptInputButton
        className={cn("px-2!", className)}
        onClick={() => attachments.openFileDialog()}
      >
        <PaperclipIcon className="size-3" />
      </PromptInputButton>
    </Tooltip>
  );
}

function QiongQiExecutionModeMenu({
  context,
  supportThinking,
  onExecutionProfileSelect,
  onApprovalPolicySelect,
}: {
  context: QiongQiContext;
  supportThinking: boolean;
  onExecutionProfileSelect: (profile: ExecutionProfile) => void;
  onApprovalPolicySelect: (policy: QiongQiContext["approvalPolicy"]) => void;
}) {
  const profile = getResolvedExecutionProfile(
    context.executionProfile,
    supportThinking,
  );
  return (
    <PromptInputActionMenu>
      <PromptInputActionMenuTrigger className="gap-1! px-2!">
        <ProfileIcon profile={profile} />
        <div className="text-xs font-normal">
          {profile === "fast" && "快速"}
          {profile === "balanced" && "均衡"}
          {profile === "deep" && "深度"}
        </div>
      </PromptInputActionMenuTrigger>
      <PromptInputActionMenuContent className="w-86">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            执行预设
          </DropdownMenuLabel>
          <ModeMenuItem
            active={profile === "fast"}
            icon={<ZapIcon className="mr-2 size-4" />}
            title="快速"
            description="最小推理预算，适合轻量问答和短任务。"
            onSelect={() => onExecutionProfileSelect("fast")}
          />
          {supportThinking && (
            <ModeMenuItem
              active={profile === "balanced"}
              icon={<LightbulbIcon className="mr-2 size-4" />}
              title="均衡"
              description="保留必要推理步骤，兼顾速度与质量。"
              onSelect={() => onExecutionProfileSelect("balanced")}
            />
          )}
          <ModeMenuItem
            active={profile === "deep"}
            icon={<GraduationCapIcon className="mr-2 size-4" />}
            title="深度"
            description="更高推理预算，适合复杂分析和长任务。"
            onSelect={() => onExecutionProfileSelect("deep")}
          />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            权限策略
          </DropdownMenuLabel>
          <PromptInputActionMenuItem
            onSelect={() => onApprovalPolicySelect("auto")}
          >
            自动批准
            {(context.approvalPolicy ?? "auto") === "auto" && (
              <CheckIcon className="ml-auto size-4" />
            )}
          </PromptInputActionMenuItem>
          <PromptInputActionMenuItem
            onSelect={() => onApprovalPolicySelect("manual")}
          >
            关键操作确认
            {context.approvalPolicy === "manual" && (
              <CheckIcon className="ml-auto size-4" />
            )}
          </PromptInputActionMenuItem>
        </DropdownMenuGroup>
      </PromptInputActionMenuContent>
    </PromptInputActionMenu>
  );
}

function QiongQiTaskModeMenu({
  taskMode,
  onTaskModeSelect,
}: {
  taskMode: TaskMode;
  onTaskModeSelect: (mode: TaskMode) => void;
}) {
  const modeLabel = taskMode === "plan" ? "规划" : "执行";
  return (
    <PromptInputActionMenu>
      <PromptInputActionMenuTrigger className="gap-1! px-2!">
        {taskMode === "plan" ? (
          <GraduationCapIcon className="size-3 text-violet-500" />
        ) : (
          <ZapIcon className="size-3 text-cyan-500" />
        )}
        <span className="text-xs font-normal">{modeLabel}</span>
      </PromptInputActionMenuTrigger>
      <PromptInputActionMenuContent className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            执行方式
          </DropdownMenuLabel>
          <ModeMenuItem
            active={taskMode === "agent"}
            icon={<ZapIcon className="mr-2 size-4 text-cyan-500" />}
            title="执行"
            description="直接进入穷奇 Agent 回合，适合边分析边完成任务。"
            onSelect={() => onTaskModeSelect("agent")}
          />
          <ModeMenuItem
            active={taskMode === "plan"}
            icon={<GraduationCapIcon className="mr-2 size-4 text-violet-500" />}
            title="规划"
            description="进入 Plan 回合，先沉淀计划文件，再继续执行。"
            onSelect={() => onTaskModeSelect("plan")}
          />
        </DropdownMenuGroup>
      </PromptInputActionMenuContent>
    </PromptInputActionMenu>
  );
}

function QiongQiCollaborationMenu({
  collaborationPolicy,
  onCollaborationPolicySelect,
}: {
  collaborationPolicy: CollaborationPolicy;
  onCollaborationPolicySelect: (policy: CollaborationPolicy) => void;
}) {
  return (
    <PromptInputActionMenu>
      <PromptInputActionMenuTrigger className="gap-1! px-2!">
        <UsersIcon className="size-3 text-amber-500" />
        <span className="text-xs font-normal">
          {collaborationPolicy === "auto" ? "自动协作" : "单智能体"}
        </span>
      </PromptInputActionMenuTrigger>
      <PromptInputActionMenuContent className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            协作策略
          </DropdownMenuLabel>
          <ModeMenuItem
            active={collaborationPolicy === "single"}
            icon={<ZapIcon className="mr-2 size-4 text-cyan-500" />}
            title="单智能体"
            description="默认稳定路径，当前任务只由主 Agent 完成。"
            onSelect={() => onCollaborationPolicySelect("single")}
          />
          <ModeMenuItem
            active={collaborationPolicy === "auto"}
            icon={<UsersIcon className="mr-2 size-4 text-amber-500" />}
            title="自动协作"
            description="保留穷奇子智能体入口；完整团队协作后续细化。"
            onSelect={() => onCollaborationPolicySelect("auto")}
          />
        </DropdownMenuGroup>
      </PromptInputActionMenuContent>
    </PromptInputActionMenu>
  );
}

function WorkModeTabs({
  mode,
  workModes,
  onModeSelect,
}: {
  mode: string;
  workModes: WorkMode[];
  onModeSelect: (mode: string) => void;
}) {
  return (
    <div className="flex justify-center">
      <div className="bg-muted/55 inline-flex items-center rounded-lg border p-1 shadow-sm">
        {workModes.map((workMode) => {
          const Icon = getWorkModeIcon(workMode);
          const active = mode === workMode.id;
          return (
            <button
              key={workMode.id}
              type="button"
              onClick={() => onModeSelect(workMode.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {workModeDisplayName(workMode)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkspaceRootMenu({
  workspaceRoot,
  workspaceRootLabel,
  workspaceHistory,
  onPickDirectory,
  onWorkspaceRootSelect,
}: {
  workspaceRoot?: string;
  workspaceRootLabel: string;
  workspaceHistory: string[];
  onPickDirectory: () => void;
  onWorkspaceRootSelect: (workspaceRoot: string | undefined) => void;
}) {
  const selectedWorkspaceRoot = isSelectedWorkspaceRoot(workspaceRoot)
    ? workspaceRoot.trim()
    : undefined;
  const presets = [
    { label: "当前会话默认", value: undefined as string | undefined },
    ...workspaceHistory.map((value) => ({
      label: getWorkspaceRootDisplayName(value),
      value,
    })),
  ];
  return (
    <div className="flex max-w-full min-w-0">
      <PromptInputActionMenu>
        <PromptInputActionMenuTrigger className="bg-background/70 h-8 max-w-full min-w-0 gap-1.5 rounded-md border px-2.5! shadow-xs">
          <FolderIcon className="text-muted-foreground size-3" />
          <span className="hidden text-xs font-medium sm:inline">工作空间</span>
          <span className="text-muted-foreground max-w-[12rem] truncate text-xs font-normal lg:max-w-[18rem]">
            {workspaceRootLabel}
          </span>
        </PromptInputActionMenuTrigger>
        <PromptInputActionMenuContent className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              工作空间
            </DropdownMenuLabel>
            <PromptInputActionMenuItem onSelect={onPickDirectory}>
              <div className="flex min-w-0 flex-col">
                <span>打开本地目录</span>
                <span className="text-muted-foreground truncate text-xs">
                  从本机选择任意工作目录
                </span>
              </div>
            </PromptInputActionMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              历史任务目录
            </DropdownMenuLabel>
            {presets.map((preset) => (
              <PromptInputActionMenuItem
                key={preset.value ?? preset.label}
                onSelect={() => onWorkspaceRootSelect(preset.value)}
              >
                <div className="flex min-w-0 flex-col">
                  <span>{preset.label}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {preset.value ?? "由穷奇运行时决定"}
                  </span>
                </div>
                {selectedWorkspaceRoot === preset.value && (
                  <CheckIcon className="ml-auto size-4" />
                )}
              </PromptInputActionMenuItem>
            ))}
          </DropdownMenuGroup>
        </PromptInputActionMenuContent>
      </PromptInputActionMenu>
    </div>
  );
}

function ModeMenuItem({
  active,
  icon,
  title,
  description,
  onSelect,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <PromptInputActionMenuItem
      className={cn(
        active ? "text-accent-foreground" : "text-muted-foreground/70",
      )}
      onSelect={onSelect}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 font-bold">
          {icon}
          {title}
        </div>
        <div className="pl-7 text-xs">{description}</div>
      </div>
      {active ? (
        <CheckIcon className="ml-auto size-4" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </PromptInputActionMenuItem>
  );
}

function ProfileIcon({ profile }: { profile: ExecutionProfile }) {
  if (profile === "balanced") return <LightbulbIcon className="size-3" />;
  if (profile === "deep") return <GraduationCapIcon className="size-3" />;
  return <ZapIcon className="size-3" />;
}
