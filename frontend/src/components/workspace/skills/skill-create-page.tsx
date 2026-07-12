"use client";

import {
  ArrowLeftIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileCode2Icon,
  Loader2Icon,
  PackageIcon,
  SaveIcon,
  SparklesIcon,
  UploadIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAnalyzeSkillDraft,
  useCreateSkill,
  useCreateSkillDraft,
  useGenerateSkillDraft,
  useInstallSkillDraft,
  useWorkModes,
} from "@/core/skills/hooks";
import type {
  GeneratedSkillDraft,
  SkillCreateRequest,
  SkillCreateResponse,
  SkillDraftEvidence,
} from "@/core/skills/type";
import { orderedWorkModes, workModeDisplayName } from "@/core/skills/work-modes";
import { cn } from "@/lib/utils";

const SKILL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

type SkillCreateFormState = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  output: string;
  procedure: string;
  workModeId: string;
};

type SkillCreateFormErrors = Partial<Record<keyof SkillCreateFormState, string>>;

type CreateMode = "blank" | "package" | "scripts";

const EMPTY_FORM: SkillCreateFormState = {
  id: "",
  name: "",
  description: "",
  trigger: "",
  output: "",
  procedure: "",
  workModeId: "office",
};

export function SkillCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedWorkModeId = searchParams.get("workModeId") ?? undefined;
  const { workModes, defaultModeId, isLoading } = useWorkModes();
  const { mutate: createSkill, isPending } = useCreateSkill();
  const { mutate: createDraft, isPending: isCreatingDraft } =
    useCreateSkillDraft();
  const { mutate: analyzeDraft, isPending: isAnalyzingDraft } =
    useAnalyzeSkillDraft();
  const { mutate: generateDraft, isPending: isGeneratingDraft } =
    useGenerateSkillDraft();
  const { mutate: installDraft, isPending: isInstallingDraft } =
    useInstallSkillDraft();
  const [mode, setMode] = useState<CreateMode>("blank");
  const [idEdited, setIdEdited] = useState(false);
  const [errors, setErrors] = useState<SkillCreateFormErrors>({});
  const [createdSkill, setCreatedSkill] = useState<SkillCreateResponse | null>(
    null,
  );
  const [form, setForm] = useState<SkillCreateFormState>(() => ({
    ...EMPTY_FORM,
    workModeId: requestedWorkModeId ?? defaultModeId ?? "office",
  }));
  const [draftId, setDraftId] = useState<string | null>(null);
  const [scriptFiles, setScriptFiles] = useState<File[]>([]);
  const [packageFiles, setPackageFiles] = useState<File[]>([]);
  const [draftEvidence, setDraftEvidence] = useState<SkillDraftEvidence | null>(
    null,
  );
  const [generatedDraft, setGeneratedDraft] =
    useState<GeneratedSkillDraft | null>(null);
  const [installedDraft, setInstalledDraft] =
    useState<SkillCreateResponse | null>(null);

  const modeOptions = useMemo(
    () =>
      orderedWorkModes(
        workModes.length > 0
          ? workModes
          : [
              {
                id: form.workModeId || defaultModeId || "office",
                name: form.workModeId || "office",
                skills: [],
              },
            ],
      ),
    [defaultModeId, form.workModeId, workModes],
  );
  const selectedWorkMode = modeOptions.find(
    (mode) => mode.id === form.workModeId,
  );
  const selectedWorkModeName = selectedWorkMode
    ? workModeDisplayName(selectedWorkMode)
    : form.workModeId;
  const previewProcedure =
    form.procedure.trim() ||
    [
      "- Confirm the user goal, required inputs, and constraints before doing work.",
      "- Keep actions scoped to the current user, task, and workspace.",
      "- Produce the requested output contract and call out missing information.",
    ].join("\n");
  const previewMarkdown = generatedDraft
    ? generatedDraft.skillMarkdown
    : [
        "---",
        `name: ${form.id || "skill-id"}`,
        `description: ${form.description || "技能描述"}`,
        "---",
        "",
        `# ${form.name || "技能名称"}`,
        "",
        "## When To Use",
        form.trigger || "触发条件",
        "",
        "## Procedure",
        previewProcedure,
        "",
        "## Output Contract",
        form.output || "输出契约",
      ].join("\n");
  const previewId = nonEmpty(generatedDraft?.metadata.id, form.id, "skill-id");

  const updateField = (field: keyof SkillCreateFormState, value: string) => {
    setCreatedSkill(null);
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !idEdited && !current.id.trim()) {
        next.id = slugFromName(value);
      }
      return next;
    });
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateSkillForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const request: SkillCreateRequest = {
      id: form.id.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      trigger: form.trigger.trim(),
      output: form.output.trim(),
      workModeId: form.workModeId,
    };
    const procedure = form.procedure.trim();
    if (procedure) request.procedure = procedure;

    createSkill(request, {
      onSuccess: (result) => {
        setCreatedSkill(result);
        toast.success(result.message || "技能已创建");
      },
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : "创建技能失败，请稍后重试";
        toast.error(message);
        setErrors((current) => ({ ...current, id: message }));
      },
    });
  };

  const selectMode = (nextMode: CreateMode) => {
    setMode(nextMode);
    setCreatedSkill(null);
    setInstalledDraft(null);
  };

  const handleScriptFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setScriptFiles(files);
    resetDraftState();
  };

  const handlePackageFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setPackageFiles(files);
    resetDraftState();
  };

  const resetDraftState = () => {
    setDraftId(null);
    setDraftEvidence(null);
    setGeneratedDraft(null);
    setInstalledDraft(null);
  };

  const handleGenerateDraft = (draftMode: "scripts" | "package") => {
    const files = draftMode === "scripts" ? scriptFiles : packageFiles;
    if (files.length === 0) {
      toast.error(draftMode === "scripts" ? "请先上传脚本文件" : "请先上传技能包文件");
      return;
    }
    setInstalledDraft(null);
    createDraft(
      { mode: draftMode, workModeId: form.workModeId, files },
      {
        onSuccess: (created) => {
          setDraftId(created.draftId);
          analyzeDraft(created.draftId, {
            onSuccess: (analysis) => {
              setDraftEvidence(analysis.evidence);
              generateDraft(created.draftId, {
                onSuccess: (generated) => {
                  setDraftEvidence(generated.evidence);
                  setGeneratedDraft(generated.draft);
                  toast.success("技能草稿已生成");
                },
                onError: (error) => {
                  toast.error(errorMessage(error, "生成技能草稿失败"));
                },
              });
            },
            onError: (error) => {
              toast.error(
                errorMessage(
                  error,
                  draftMode === "scripts" ? "分析脚本失败" : "分析技能包失败",
                ),
              );
            },
          });
        },
        onError: (error) => {
          toast.error(
            errorMessage(
              error,
              draftMode === "scripts" ? "上传脚本失败" : "上传技能包失败",
            ),
          );
        },
      },
    );
  };

  const handleInstallGeneratedDraft = () => {
    if (!draftId || !generatedDraft) return;
    installDraft(
      {
        draftId,
        request: {
          ...generatedDraft,
          workModeId: form.workModeId,
          confirmations: ["exec-workspace"],
        },
      },
      {
        onSuccess: (result) => {
          setInstalledDraft(result);
          toast.success(result.message || "技能已安装");
        },
        onError: (error) => {
          toast.error(errorMessage(error, "安装技能草稿失败"));
        },
      },
    );
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-col">
      <header className="border-b px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => router.push("/workspace/skills")}
              aria-label="返回技能列表"
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-normal">
                  创建技能
                </h1>
                <Badge variant="secondary" className="gap-1">
                  <SparklesIcon className="size-3" />
                  专用向导
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                生成并安装一个用户自定义技能，绑定到当前工作模式。
              </p>
            </div>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <FileCode2Icon className="size-4" />
            {selectedWorkModeName}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          <div className="grid gap-3 md:grid-cols-3">
            <ModeCard
              active={mode === "blank"}
              icon={<SparklesIcon className="size-4" />}
              title="空白创建"
              description="手动填写触发条件、步骤和输出契约。"
              onClick={() => selectMode("blank")}
            />
            <ModeCard
              active={mode === "package"}
              icon={<PackageIcon className="size-4" />}
              title="导入现成技能"
              description="上传 SKILL.md、.skill 或技能包草稿。"
              onClick={() => selectMode("package")}
            />
            <ModeCard
              active={mode === "scripts"}
              icon={<FileCode2Icon className="size-4" />}
              title="从脚本生成"
              description="上传命令脚本，自动识别入口和参数。"
              onClick={() => selectMode("scripts")}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            {mode === "blank" ? (
              <form
                className="border-border bg-card flex min-w-0 flex-col gap-5 rounded-lg border p-5"
                onSubmit={submit}
              >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="技能 ID"
                error={errors.id}
                hint="小写英文、数字或连字符，例如 report-search"
              >
                <Input
                  name="id"
                  value={form.id}
                  placeholder="report-search"
                  aria-invalid={Boolean(errors.id)}
                  onChange={(event) => {
                    setIdEdited(true);
                    updateField("id", event.target.value.trim());
                  }}
                />
              </Field>
              <Field label="显示名称" error={errors.name}>
                <Input
                  name="name"
                  value={form.name}
                  placeholder="研报搜索"
                  aria-invalid={Boolean(errors.name)}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </Field>
            </div>

            <Field label="一句话描述" error={errors.description}>
              <Input
                name="description"
                value={form.description}
                placeholder="搜索和整理证券研究资料"
                aria-invalid={Boolean(errors.description)}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
              />
            </Field>

            <Field label="触发条件" error={errors.trigger}>
              <Textarea
                name="trigger"
                className="min-h-24"
                value={form.trigger}
                placeholder="用户需要搜索研报、整理证券研究资料或生成研报摘要"
                aria-invalid={Boolean(errors.trigger)}
                onChange={(event) => updateField("trigger", event.target.value)}
              />
            </Field>

            <Field label="输出契约" error={errors.output}>
              <Textarea
                name="output"
                className="min-h-24"
                value={form.output}
                placeholder="Markdown 摘要，包含来源、要点、风险提示和后续问题"
                aria-invalid={Boolean(errors.output)}
                onChange={(event) => updateField("output", event.target.value)}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <Field label="执行步骤">
                <Textarea
                  name="procedure"
                  className="min-h-28"
                  value={form.procedure}
                  placeholder={"1. 明确主题和范围\n2. 检索资料\n3. 输出结构化摘要"}
                  onChange={(event) =>
                    updateField("procedure", event.target.value)
                  }
                />
              </Field>
              <Field label="绑定工作模式">
                <select
                  name="workModeId"
                  className={cn(
                    "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none transition-[color,box-shadow]",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  )}
                  value={form.workModeId}
                  disabled={isLoading}
                  onChange={(event) =>
                    updateField("workModeId", event.target.value)
                  }
                >
                  {modeOptions.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {workModeDisplayName(mode)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {createdSkill && (
              <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2Icon className="size-4" />
                <AlertTitle>技能已创建</AlertTitle>
                <AlertDescription>
                  <span>{createdSkill.root}</span>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/workspace/skills")}
              >
                返回技能列表
              </Button>
              <div className="flex gap-2">
                {createdSkill?.workModeId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const params = new URLSearchParams({
                        workModeId: createdSkill.workModeId!,
                      });
                      router.push(`/workspace/chats/new?${params.toString()}`);
                    }}
                  >
                    开始使用
                  </Button>
                )}
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <SaveIcon className="size-4" />
                  )}
                  创建并安装
                </Button>
              </div>
            </div>
              </form>
            ) : (
              <div className="border-border bg-card flex min-w-0 flex-col gap-5 rounded-lg border p-5">
                {mode === "scripts" ? (
                  <ScriptDraftPanel
                    evidence={draftEvidence}
                    files={scriptFiles}
                    generatedDraft={generatedDraft}
                    installedDraft={installedDraft}
                    isBusy={
                      isCreatingDraft ||
                      isAnalyzingDraft ||
                      isGeneratingDraft ||
                      isInstallingDraft
                    }
                    isGenerating={
                      isCreatingDraft || isAnalyzingDraft || isGeneratingDraft
                    }
                    isInstalling={isInstallingDraft}
                    onFileChange={handleScriptFilesChange}
                    onGenerate={() => handleGenerateDraft("scripts")}
                    onInstall={handleInstallGeneratedDraft}
                  />
                ) : (
                  <PackageImportPanel
                    evidence={draftEvidence}
                    files={packageFiles}
                    generatedDraft={generatedDraft}
                    installedDraft={installedDraft}
                    isBusy={
                      isCreatingDraft ||
                      isAnalyzingDraft ||
                      isGeneratingDraft ||
                      isInstallingDraft
                    }
                    isGenerating={
                      isCreatingDraft || isAnalyzingDraft || isGeneratingDraft
                    }
                    isInstalling={isInstallingDraft}
                    onFileChange={handlePackageFilesChange}
                    onGenerate={() => handleGenerateDraft("package")}
                    onInstall={handleInstallGeneratedDraft}
                  />
                )}
              </div>
            )}

          <aside className="border-border bg-card h-fit rounded-lg border p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">技能预览</h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  {previewId} · {selectedWorkModeName}
                </p>
              </div>
              <Badge variant="outline">SKILL.md</Badge>
            </div>
            <pre className="bg-muted/60 text-muted-foreground max-h-[560px] overflow-auto rounded-md p-3 text-xs leading-5 whitespace-pre-wrap">
              {previewMarkdown}
            </pre>
          </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  description,
  icon,
  onClick,
  title,
}: {
  active: boolean;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "border-border bg-card text-left rounded-lg border p-4 transition-colors",
        "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
        active && "border-primary bg-primary/5",
      )}
      onClick={onClick}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span
          className={cn(
            "border-border bg-background flex size-7 items-center justify-center rounded-md border",
            active && "border-primary text-primary",
          )}
        >
          {icon}
        </span>
        {title}
      </span>
      <span className="text-muted-foreground mt-2 block text-xs leading-5">
        {description}
      </span>
    </button>
  );
}

function ScriptDraftPanel({
  evidence,
  files,
  generatedDraft,
  installedDraft,
  isBusy,
  isGenerating,
  isInstalling,
  onFileChange,
  onGenerate,
  onInstall,
}: {
  evidence: SkillDraftEvidence | null;
  files: File[];
  generatedDraft: GeneratedSkillDraft | null;
  installedDraft: SkillCreateResponse | null;
  isBusy: boolean;
  isGenerating: boolean;
  isInstalling: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
  onInstall: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">上传命令脚本</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            支持 Python、Shell、Node 脚本。系统会先识别入口、参数和风险，再生成可编辑技能草稿。
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          scripts/
        </Badge>
      </div>

      <label className="border-border bg-muted/30 hover:bg-muted/50 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors">
        <UploadIcon className="text-muted-foreground size-6" />
        <span className="text-sm font-medium">选择脚本文件</span>
        <span className="text-muted-foreground text-xs">
          上传后不会执行脚本，只做静态识别。
        </span>
        <input
          className="sr-only"
          multiple
          type="file"
          onChange={onFileChange}
        />
      </label>

      {files.length > 0 && (
        <div className="border-border rounded-md border">
          <div className="border-b px-3 py-2 text-xs font-medium">已选择文件</div>
          <div className="divide-border divide-y">
            {files.map((file) => (
              <div
                key={`${file.name}-${file.size}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="truncate">{file.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatBytes(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          命令会被改写为技能包内相对路径，例如 python scripts/convert.py。
        </p>
        <Button
          type="button"
          disabled={files.length === 0 || isBusy}
          onClick={onGenerate}
        >
          {isGenerating ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          识别并生成草稿
        </Button>
      </div>

      {evidence && (
        <div className="grid gap-3 md:grid-cols-3">
          <EvidenceBlock
            label="入口"
            value={evidence.entryCandidates[0]?.path ?? "未识别"}
          />
          <EvidenceBlock
            label="命令"
            value={evidence.commands[0]?.suggestedInvocation ?? "待确认"}
          />
          <EvidenceBlock
            label="依赖"
            value={
              evidence.dependencies.map((dependency) => dependency.name).join(", ") ||
              "无"
            }
          />
        </div>
      )}

      {generatedDraft && (
        <div className="border-border rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                {generatedDraft.metadata.name}
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                {generatedDraft.metadata.description}
              </p>
            </div>
            <Badge variant="outline">{generatedDraft.metadata.id}</Badge>
          </div>
          {generatedDraft.warnings.length > 0 && (
            <div className="mt-3 space-y-2">
              {generatedDraft.warnings.map((warning) => (
                <div
                  key={warning.message}
                  className="text-amber-700 dark:text-amber-300 flex gap-2 text-xs"
                >
                  <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={isInstalling}
              onClick={onInstall}
            >
              {isInstalling ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              确认安装
            </Button>
          </div>
        </div>
      )}

      {installedDraft && (
        <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2Icon className="size-4" />
          <AlertTitle>技能已安装</AlertTitle>
          <AlertDescription>{installedDraft.root}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

function PackageImportPanel({
  evidence,
  files,
  generatedDraft,
  installedDraft,
  isBusy,
  isGenerating,
  isInstalling,
  onFileChange,
  onGenerate,
  onInstall,
}: {
  evidence: SkillDraftEvidence | null;
  files: File[];
  generatedDraft: GeneratedSkillDraft | null;
  installedDraft: SkillCreateResponse | null;
  isBusy: boolean;
  isGenerating: boolean;
  isInstalling: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
  onInstall: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">上传技能包</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            支持 zip 技能包，或直接上传 SKILL.md、skill.json 和资源文件。系统会自动解压、识别并安装到用户技能空间。
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          package
        </Badge>
      </div>

      <label className="border-border bg-muted/30 hover:bg-muted/50 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors">
        <PackageIcon className="text-muted-foreground size-6" />
        <span className="text-sm font-medium">选择技能包文件</span>
        <span className="text-muted-foreground text-xs">
          上传 zip 会在服务端安全解压；原始压缩包不会作为技能脚本保留。
        </span>
        <input
          accept=".zip,.skill,.md,.json,.py,.sh,.js,.ts,.mjs,.cjs,.txt"
          className="sr-only"
          multiple
          type="file"
          onChange={onFileChange}
        />
      </label>

      {files.length > 0 && (
        <div className="border-border rounded-md border">
          <div className="border-b px-3 py-2 text-xs font-medium">已选择文件</div>
          <div className="divide-border divide-y">
            {files.map((file) => {
              const relativePath = (
                file as File & { webkitRelativePath?: string }
              ).webkitRelativePath;
              return (
                <div
                  key={`${relativePath || file.name}-${file.size}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="truncate">{relativePath || file.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatBytes(file.size)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          安装后模型默认从用户技能空间发现该技能，不需要在当前工作区查找。
        </p>
        <Button
          type="button"
          disabled={files.length === 0 || isBusy}
          onClick={onGenerate}
        >
          {isGenerating ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          分析并导入
        </Button>
      </div>

      {evidence && (
        <div className="grid gap-3 md:grid-cols-3">
          <EvidenceBlock
            label="入口"
            value={evidence.entryCandidates[0]?.path ?? "SKILL.md"}
          />
          <EvidenceBlock
            label="文件"
            value={`${evidence.files.length} 个文件`}
          />
          <EvidenceBlock
            label="资源"
            value={
              evidence.files
                .filter((file) => file.path !== "SKILL.md" && file.path !== "skill.json")
                .slice(0, 2)
                .map((file) => file.path)
                .join(", ") || "无"
            }
          />
        </div>
      )}

      {generatedDraft && (
        <div className="border-border rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                {generatedDraft.metadata.name}
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                {generatedDraft.metadata.description}
              </p>
            </div>
            <Badge variant="outline">{generatedDraft.metadata.id}</Badge>
          </div>
          {generatedDraft.warnings.length > 0 && (
            <div className="mt-3 space-y-2">
              {generatedDraft.warnings.map((warning) => (
                <div
                  key={warning.message}
                  className="text-amber-700 dark:text-amber-300 flex gap-2 text-xs"
                >
                  <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={isInstalling}
              onClick={onInstall}
            >
              {isInstalling ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              确认安装
            </Button>
          </div>
        </div>
      )}

      {installedDraft && (
        <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2Icon className="size-4" />
          <AlertTitle>技能已安装</AlertTitle>
          <AlertDescription>{installedDraft.root}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

function EvidenceBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-md p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-destructive text-xs font-normal">{error}</span>
      ) : hint ? (
        <span className="text-muted-foreground text-xs font-normal">{hint}</span>
      ) : null}
    </label>
  );
}

function validateSkillForm(form: SkillCreateFormState): SkillCreateFormErrors {
  const errors: SkillCreateFormErrors = {};
  if (!form.id.trim()) errors.id = "请输入技能 ID";
  else if (!SKILL_ID_PATTERN.test(form.id.trim())) {
    errors.id = "技能 ID 只能包含小写英文、数字和连字符";
  }
  if (!form.name.trim()) errors.name = "请输入显示名称";
  if (!form.description.trim()) errors.description = "请输入一句话描述";
  if (!form.trigger.trim()) errors.trigger = "请输入触发条件";
  if (!form.output.trim()) errors.output = "请输入输出契约";
  return errors;
}

function slugFromName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function nonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}
