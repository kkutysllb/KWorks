"use client";

import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  FileCode2Icon,
  Loader2Icon,
  SaveIcon,
  SparklesIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSkill, useWorkModes } from "@/core/skills/hooks";
import type {
  SkillCreateRequest,
  SkillCreateResponse,
  WorkMode,
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

const EMPTY_FORM: SkillCreateFormState = {
  id: "",
  name: "",
  description: "",
  trigger: "",
  output: "",
  procedure: "",
  workModeId: "task",
};

export function SkillCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedWorkModeId = searchParams.get("workModeId") ?? undefined;
  const { workModes, defaultModeId, isLoading } = useWorkModes();
  const { mutate: createSkill, isPending } = useCreateSkill();
  const [idEdited, setIdEdited] = useState(false);
  const [errors, setErrors] = useState<SkillCreateFormErrors>({});
  const [createdSkill, setCreatedSkill] = useState<SkillCreateResponse | null>(
    null,
  );
  const [form, setForm] = useState<SkillCreateFormState>(() => ({
    ...EMPTY_FORM,
    workModeId: requestedWorkModeId ?? defaultModeId ?? "task",
  }));

  const modeOptions = useMemo(
    () =>
      orderedWorkModes(
        workModes.length > 0
          ? workModes
          : [
              {
                id: form.workModeId || defaultModeId || "task",
                name: form.workModeId || "task",
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
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
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

          <aside className="border-border bg-card h-fit rounded-lg border p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">技能预览</h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  {form.id || "skill-id"} · {selectedWorkModeName}
                </p>
              </div>
              <Badge variant="outline">SKILL.md</Badge>
            </div>
            <pre className="bg-muted/60 text-muted-foreground max-h-[560px] overflow-auto rounded-md p-3 text-xs leading-5 whitespace-pre-wrap">
              {[
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
              ].join("\n")}
            </pre>
          </aside>
        </div>
      </div>
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
