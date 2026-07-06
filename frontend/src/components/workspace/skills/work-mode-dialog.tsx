"use client";

import {
  BookOpenIcon,
  ChartBarIcon,
  Code2Icon,
  DatabaseIcon,
  Edit3Icon,
  FileSearchIcon,
  GlobeIcon,
  NewspaperIcon,
  PencilRulerIcon,
  PlusIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateWorkMode,
  useDeleteWorkMode,
  useUpdateWorkMode,
} from "@/core/skills/hooks";
import type {
  WorkMode,
  WorkModeUpdateRequest,
  WorkModeWriteRequest,
} from "@/core/skills/type";
import {
  orderedWorkModes,
  workModeDisplayName,
} from "@/core/skills/work-modes";
import { cn } from "@/lib/utils";

type WorkModeDialogProps = {
  workModes: WorkMode[];
  onSelectWorkMode?: (workModeId: string) => void;
  /** When set, opens the dialog and enters edit mode for this mode id. */
  editRequest?: { modeId: string; nonce: number } | null;
};

type WorkModeFormState = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

const DEFAULT_ICON_ID = "sparkles";
const MODE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

type IconOption = {
  id: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

const DEFAULT_ICON_OPTION: IconOption = {
  id: DEFAULT_ICON_ID,
  label: "通用",
  Icon: SparklesIcon,
};

const ICON_OPTIONS: IconOption[] = [
  DEFAULT_ICON_OPTION,
  { id: "office", label: "办公", Icon: BookOpenIcon },
  { id: "chart", label: "分析", Icon: ChartBarIcon },
  { id: "code", label: "代码", Icon: Code2Icon },
  { id: "search", label: "检索", Icon: FileSearchIcon },
  { id: "web", label: "网页", Icon: GlobeIcon },
  { id: "newspaper", label: "资讯", Icon: NewspaperIcon },
  { id: "writing", label: "写作", Icon: PencilRulerIcon },
  { id: "database", label: "数据", Icon: DatabaseIcon },
  { id: "shield", label: "安全", Icon: ShieldCheckIcon },
];

const EMPTY_FORM: WorkModeFormState = {
  id: "",
  name: "",
  description: "",
  icon: DEFAULT_ICON_ID,
};

export function WorkModeDialog({
  workModes,
  onSelectWorkMode,
  editRequest,
}: WorkModeDialogProps) {
  const [open, setOpen] = useState(false);
  const [editingModeId, setEditingModeId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkModeFormState>(EMPTY_FORM);
  const { mutate: createWorkMode, isPending: isCreating } = useCreateWorkMode();
  const { mutate: updateWorkMode, isPending: isUpdating } = useUpdateWorkMode();
  const { mutate: deleteWorkMode, isPending: isDeleting } = useDeleteWorkMode();
  const sortedWorkModes = useMemo(
    () => orderedWorkModes(workModes),
    [workModes],
  );
  const editingMode = editingModeId
    ? workModes.find((mode) => mode.id === editingModeId)
    : undefined;
  const isSubmitting = isCreating || isUpdating;

  useEffect(() => {
    if (!open) {
      setEditingModeId(null);
      setForm(EMPTY_FORM);
    }
  }, [open]);

  // External edit trigger: when editRequest changes, open the dialog and
  // pre-select the mode for editing.
  useEffect(() => {
    if (!editRequest) return;
    const mode = workModes.find((m) => m.id === editRequest.modeId);
    if (!mode) return;
    startEdit(mode);
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest?.nonce]);

  const startCreate = () => {
    setEditingModeId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (mode: WorkMode) => {
    if (mode.builtin || mode.editable === false) return;
    setEditingModeId(mode.id);
    setForm({
      id: mode.id,
      name: workModeDisplayName(mode),
      description: mode.description ?? "",
      icon: iconOptionFor(mode.icon).id,
    });
  };

  const submit = () => {
    const id = form.id.trim();
    const name = form.name.trim();
    const description = form.description.trim();
    const icon = iconOptionFor(form.icon).id;
    if (!editingMode && !id) {
      toast.error("模式 ID 不能为空");
      return;
    }
    if (!editingMode && !MODE_ID_PATTERN.test(id)) {
      toast.error("模式 ID 仅支持小写英文、数字和连字符");
      return;
    }
    if (!name) {
      toast.error("工作模式名称不能为空");
      return;
    }
    if (!description) {
      toast.error("智能体说明不能为空");
      return;
    }
    if (editingMode) {
      const payload: WorkModeUpdateRequest = { name, description, icon };
      updateWorkMode(
        { workModeId: editingMode.id, request: payload },
        {
          onSuccess: (mode) => {
            toast.success("工作模式已更新");
            onSelectWorkMode?.(mode.id);
            startCreate();
          },
          onError: (err) =>
            toast.error(
              err instanceof Error ? err.message : "更新工作模式失败",
            ),
        },
      );
      return;
    }
    const payload: WorkModeWriteRequest = { id, name, description, icon };
    createWorkMode(payload, {
      onSuccess: (mode) => {
        toast.success("工作模式已创建");
        onSelectWorkMode?.(mode.id);
        startCreate();
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "创建工作模式失败"),
    });
  };

  const remove = (mode: WorkMode) => {
    if (mode.builtin || mode.editable === false) return;
    deleteWorkMode(mode.id, {
      onSuccess: () => {
        toast.success("工作模式已删除");
        if (editingModeId === mode.id) startCreate();
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "删除工作模式失败"),
    });
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Settings2Icon className="size-4" />
        工作模式
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] min-h-0 flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>工作模式管理</DialogTitle>
            <DialogDescription>
              自定义工作模式会作为用户级配置保存，并绑定自己的技能体系。
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1 md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] md:overflow-hidden md:pr-0">
            <div className="flex min-w-0 flex-col gap-2 overflow-y-auto pr-1">
              {sortedWorkModes.map((mode) => {
                const mutable = !mode.builtin && mode.editable !== false;
                return (
                  <Item
                    key={mode.id}
                    variant="outline"
                    className="min-w-0 items-start"
                  >
                    <ItemContent className="min-w-0">
                      <ItemTitle className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          {(() => {
                            const Icon = iconOptionFor(mode.icon).Icon;
                            return (
                              <Icon className="text-muted-foreground size-4 shrink-0" />
                            );
                          })()}
                          <span className="truncate">
                            {workModeDisplayName(mode)}
                          </span>
                        </span>
                      </ItemTitle>
                      <ItemDescription className="min-w-0">
                        <span className="block truncate text-xs">
                          {mode.id}
                          {mode.builtin ? " · 系统内置" : " · 用户自定义"}
                        </span>
                        {mode.description && (
                          <span className="mt-1 line-clamp-2 block">
                            {mode.description}
                          </span>
                        )}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="self-start">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={!mutable}
                        onClick={() => startEdit(mode)}
                        aria-label="编辑工作模式"
                      >
                        <Edit3Icon className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={!mutable || isDeleting}
                        onClick={() => remove(mode)}
                        aria-label="删除工作模式"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </ItemActions>
                  </Item>
                );
              })}
            </div>
            <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {editingMode ? "编辑模式" : "新建模式"}
                </p>
                {editingMode && (
                  <Button size="sm" variant="ghost" onClick={startCreate}>
                    <PlusIcon className="size-4" />
                    新建
                  </Button>
                )}
              </div>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground text-xs">名称 *</span>
                <Input
                  value={form.name}
                  placeholder="财经研判"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground text-xs">模式 ID *</span>
                <Input
                  value={form.id}
                  disabled={Boolean(editingMode)}
                  placeholder="finance-review"
                  pattern="[a-z0-9][a-z0-9-]{0,63}"
                  aria-describedby="work-mode-id-help"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      id: normalizeModeIdInput(event.target.value),
                    }))
                  }
                />
                <span
                  id="work-mode-id-help"
                  className="text-muted-foreground block text-xs leading-5"
                >
                  系统内部标识，创建后不可修改；仅支持小写英文、数字和连字符，例如
                  finance-review。
                </span>
              </label>
              <div className="space-y-1.5 text-sm">
                <span className="text-muted-foreground text-xs">图标</span>
                <div
                  className="grid grid-cols-5 gap-2"
                  role="radiogroup"
                  aria-label="图标"
                >
                  {ICON_OPTIONS.map((option) => {
                    const Icon = option.Icon;
                    const selected = form.icon === option.id;
                    return (
                      <Button
                        key={option.id}
                        type="button"
                        size="icon-sm"
                        variant={selected ? "secondary" : "outline"}
                        title={option.label}
                        aria-label={`选择图标：${option.label}`}
                        aria-checked={selected}
                        role="radio"
                        className={cn(
                          "size-9",
                          selected && "border-primary text-primary",
                        )}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            icon: option.id,
                          }))
                        }
                      >
                        <Icon className="size-4" />
                        <span className="sr-only">{option.label}</span>
                      </Button>
                    );
                  })}
                </div>
                <span className="text-muted-foreground block text-xs leading-5">
                  选择图标即可，不需要手动输入图标名称。
                </span>
              </div>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground text-xs">
                  智能体说明 *
                </span>
                <Textarea
                  value={form.description}
                  className="h-40 min-h-32 resize-y overflow-y-auto field-sizing-fixed"
                  required
                  aria-describedby="work-mode-description-help"
                  placeholder="例如：负责财经研判任务，优先核对公告、研报和市场数据，输出结论、依据、风险点和后续跟踪项。"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
                <span
                  id="work-mode-description-help"
                  className="text-muted-foreground block text-xs leading-5"
                >
                  会进入当前工作模式的运行上下文，用来告诉模型这个单智能体的任务边界、工作方法和默认关注点。
                </span>
              </label>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
            <Button onClick={submit} disabled={isSubmitting}>
              {isSubmitting
                ? "保存中..."
                : editingMode
                  ? "保存修改"
                  : "创建模式"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function iconOptionFor(icon: string | undefined): IconOption {
  return (
    ICON_OPTIONS.find((option) => option.id === icon) ?? DEFAULT_ICON_OPTION
  );
}

function normalizeModeIdInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_.\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}
