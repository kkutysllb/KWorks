"use client";

import {
  CpuIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  Settings2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { useI18n } from "@/core/i18n/hooks";
import type { Model, ModelRequest } from "@/core/models/types";

interface ModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model?: Model | null;
  onSave: (req: ModelRequest) => Promise<void>;
}

const labelCls = "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70";
const hintCls = "text-muted-foreground text-xs";
const sectionTitleCls = "text-xs font-semibold uppercase tracking-wider text-muted-foreground/70";

interface ApiKeyInputState {
  nextInputValue: string;
  showApiKey: boolean;
}

export function getNextApiKeyInputState({
  nextInputValue,
  showApiKey,
}: ApiKeyInputState): { apiKey: string; showApiKey: boolean } {
  if (!showApiKey) {
    return {
      apiKey: nextInputValue,
      showApiKey: true,
    };
  }
  return {
    apiKey: nextInputValue,
    showApiKey,
  };
}

interface ApiKeyRequestValueInput {
  apiKey: string;
  originalApiKey: string;
  showApiKey: boolean;
}

export function toApiKeyRequestValue({
  apiKey,
  originalApiKey,
  showApiKey,
}: ApiKeyRequestValueInput): string | null {
  const trimmed = apiKey.trim();
  if (!showApiKey && trimmed === originalApiKey.trim()) {
    return null;
  }
  return trimmed || null;
}

/** Mask an API key: show first 7 and last 4 chars, obscure the middle. */
function maskApiKey(key: string | null | undefined): string {
  if (!key || key.trim().length === 0) return "";
  const k = key.trim();
  if (k.startsWith("$")) return k; // env var reference — show as-is
  if (k.length <= 12) return k.slice(0, 3) + "···" + k.slice(-3);
  return k.slice(0, 7) + "···" + k.slice(-4);
}

export function ModelDialog({
  open,
  onOpenChange,
  model,
  onSave,
}: ModelDialogProps) {
  const { t } = useI18n();
  const isEdit = !!model;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [originalApiKey, setOriginalApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [errFields, setErrFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      if (model) {
        setName(model.name);
        setDisplayName(model.display_name ?? "");
        setModelId(model.model ?? "");
        setApiKey(model.api_key ?? "");
        setOriginalApiKey(model.api_key ?? "");
        setBaseUrl(model.base_url ?? "");
      } else {
        setName("");
        setDisplayName("");
        setModelId("");
        setApiKey("");
        setOriginalApiKey("");
        setBaseUrl("");
      }
      setShowApiKey(false);
      setError(null);
      setErrFields(new Set());
    }
  }, [open, model]);

  const handleSave = async () => {
    const missing = new Set<string>();
    if (!name.trim()) missing.add("name");
    if (!modelId.trim()) missing.add("modelId");
    setErrFields(missing);
    if (missing.size > 0) return;

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        display_name: displayName.trim() || null,
        model: modelId.trim(),
        api_key: toApiKeyRequestValue({
          apiKey,
          originalApiKey,
          showApiKey,
        }),
        base_url: baseUrl.trim() || null,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = (field: string) =>
    errFields.has(field) ? "border-destructive" : "";

  const maskedApiKey = useMemo(() => maskApiKey(apiKey), [apiKey]);
  const displayApiKey = showApiKey ? apiKey : maskedApiKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-xl">
        {/* Emerald accent bar */}
        <div className="h-1.5 w-full rounded-t-lg bg-gradient-to-r from-emerald-400 to-teal-400" />

        <DialogHeader className="px-6 pt-5">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CpuIcon className="h-4 w-4" />
            </span>
            {isEdit ? t.models.editModel : t.models.addModel}
          </DialogTitle>
          <DialogDescription className="pl-10">
            {isEdit ? `"${model?.name}"` : t.models.emptyDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* ── 基本信息 ── */}
          <div className="space-y-3">
            <p className={sectionTitleCls}>
              <Settings2Icon className="mr-1.5 inline h-3.5 w-3.5" />
              {t.common.more}
            </p>
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-2">
                <label htmlFor="md-name" className={labelCls}>
                  {t.models.name} <span className="text-emerald-500 font-bold">*</span>
                </label>
                <Input
                  id="md-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="gpt-4"
                  disabled={isEdit}
                  className={fieldCls("name")}
                />
                <p className={hintCls}>{t.models.nameHint}</p>
              </div>

              <div className="grid gap-2">
                <label htmlFor="md-display" className={labelCls}>
                  {t.models.displayName}
                </label>
                <Input
                  id="md-display"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="GPT-4"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="md-model" className={labelCls}>
                  {t.models.modelId} <span className="text-emerald-500 font-bold">*</span>
                </label>
                <Input
                  id="md-model"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="gpt-4o"
                  className={fieldCls("modelId")}
                />
                <p className={hintCls}>{t.models.modelIdHint}</p>
              </div>
            </div>
          </div>

          {/* ── 连接配置 ── */}
          <div className="space-y-3">
            <p className={sectionTitleCls}>
              <GlobeIcon className="mr-1.5 inline h-3.5 w-3.5" />
              连接配置
            </p>
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-2">
                <label htmlFor="md-apikey" className={labelCls}>
                  {t.models.apiKey}
                </label>
                <div className="relative">
                  <Input
                    id="md-apikey"
                    type={showApiKey ? "text" : "password"}
                    value={displayApiKey}
                    onChange={(e) => {
                      const next = getNextApiKeyInputState({
                        nextInputValue: e.target.value,
                        showApiKey,
                      });
                      setShowApiKey(next.showApiKey);
                      setApiKey(next.apiKey);
                    }}
                    onFocus={() => {
                      if (apiKey && !showApiKey) {
                        setShowApiKey(true);
                      }
                    }}
                    placeholder="$OPENAI_API_KEY"
                    className="pr-10"
                    autoComplete="off"
                  />
                  {apiKey && (
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showApiKey ? "Hide API key" : "Show API key"}
                    >
                      {showApiKey ? (
                        <EyeOffIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
                <p className={hintCls}>{t.models.apiKeyHint}</p>
              </div>

              <div className="grid gap-2">
                <label htmlFor="md-baseurl" className={labelCls}>
                  {t.models.baseUrl}
                </label>
                <Input
                  id="md-baseurl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
                <p className={hintCls}>{t.models.baseUrlHint}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="mx-6 text-destructive text-sm rounded-md bg-destructive/5 px-3 py-2">{error}</p>
        )}

        <DialogFooter className="px-6 pb-5">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm"
          >
            {saving ? t.common.loading : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
