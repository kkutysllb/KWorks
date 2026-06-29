"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  BoxIcon,
  BrainIcon,
  CpuIcon,
  DatabaseIcon,
  GlobeIcon,
  Loader2Icon,
  NetworkIcon,
  RadioTowerIcon,
  Settings2Icon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  loadConfig,
  saveFullConfig,
  saveConfigSection,
} from "@/core/settings-config/api";
import { cn } from "@/lib/utils";

export type ConfigPage =
  | "models"
  | "contextCompaction"
  | "storage"
  | "observability"
  | "mcp"
  | "web"
  | "skills"
  | "subagents";

type JsonObject = Record<string, unknown>;
type QiongqiConfig = {
  serve?: JsonObject;
  models?: { profiles?: Record<string, JsonObject> };
  contextCompaction?: JsonObject;
  runtime?: JsonObject;
  capabilities?: {
    mcp?: JsonObject;
    web?: JsonObject;
    skills?: JsonObject;
    subagents?: JsonObject;
  };
};

const DEFAULT_CONFIG: QiongqiConfig = {
  serve: {
    host: "127.0.0.1",
    port: 8899,
    dataDir: "~/.kworks-workspace-web/users/runtime",
    endpointFormat: "openai_compatible",
    approvalPolicy: "auto",
    sandboxMode: "workspace-write",
    tokenEconomyMode: false,
    tokenEconomy: {
      enabled: false,
      compressToolDescriptions: true,
      compressToolResults: true,
      conciseResponses: true,
      historyHygiene: {
        maxToolResultLines: 320,
        maxToolResultBytes: 32768,
        maxToolResultTokens: 8000,
        maxToolArgumentStringBytes: 8192,
        maxToolArgumentStringTokens: 2000,
        maxArrayItems: 80,
      },
    },
    insecure: false,
    storage: { backend: "hybrid" },
    observability: {
      openTelemetry: {
        enabled: false,
        serviceName: "qiongqi",
        exporter: "otlp-http",
        endpoint: "http://127.0.0.1:4318/v1/traces",
        headers: {},
      },
    },
  },
  models: { profiles: {} },
  contextCompaction: {
    defaultSoftThreshold: 16000,
    defaultHardThreshold: 24000,
    summaryMode: "heuristic",
    summaryTimeoutMs: 15000,
    summaryMaxTokens: 1200,
    summaryInputMaxBytes: 98304,
  },
  runtime: {
    toolStorm: { enabled: true, windowSize: 8, threshold: 2 },
    toolArgumentRepair: { maxStringBytes: 8192 },
  },
  capabilities: {
    mcp: {
      enabled: false,
      search: {
        enabled: false,
        mode: "auto",
        autoThresholdToolCount: 24,
        topKDefault: 5,
        topKMax: 10,
        minScore: 0.15,
        bm25: { k1: 1.2, b: 0.75 },
      },
      servers: {},
    },
    web: {
      enabled: false,
      fetchEnabled: false,
      searchEnabled: false,
      allowDomains: [],
      denyDomains: [],
    },
    skills: {
      enabled: false,
      roots: [],
      legacySkillMd: true,
      marketplace: { autoUpdate: false },
      enabledSkills: {},
    },
    subagents: {
      enabled: false,
      maxParallel: 0,
      maxChildRuns: 0,
    },
  },
};

const nav: Array<{
  id: ConfigPage;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "models", label: "模型 Profiles", path: "models.profiles", icon: CpuIcon },
  { id: "contextCompaction", label: "上下文压缩", path: "contextCompaction", icon: BrainIcon },
  { id: "storage", label: "存储", path: "serve.storage", icon: DatabaseIcon },
  { id: "observability", label: "观测", path: "serve.observability", icon: RadioTowerIcon },
  { id: "mcp", label: "MCP", path: "capabilities.mcp", icon: NetworkIcon },
  { id: "web", label: "Web 能力", path: "capabilities.web", icon: GlobeIcon },
  { id: "skills", label: "技能", path: "capabilities.skills", icon: SparklesIcon },
  { id: "subagents", label: "智能体协作", path: "capabilities.subagents", icon: BoxIcon },
];

const labelCls = "text-sm font-medium leading-none";
const hintCls = "text-muted-foreground mt-1 text-xs";

type ConfigSettingsPageProps = {
  initialPage?: ConfigPage;
  showNav?: boolean;
  onWriteStatusChange?: (status: ConfigWriteStatus) => void;
};

export type ConfigWriteStatus =
  | { kind: "idle" }
  | { kind: "dirty"; message: string }
  | { kind: "writing"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ConfigSettingsPage({
  initialPage = "models",
  showNav = true,
  onWriteStatusChange,
}: ConfigSettingsPageProps = {}) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<ConfigPage>(initialPage);
  const [config, setConfig] = useState<QiongqiConfig>(() => clone(DEFAULT_CONFIG));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtySections, setDirtySections] = useState<Set<ConfigPage>>(
    () => new Set(),
  );
  const [selectedProfile, setSelectedProfile] = useState("");
  const saveVersionRef = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setConfig(mergeConfig(DEFAULT_CONFIG, (await loadConfig()) as QiongqiConfig));
      setDirtySections(new Set());
      onWriteStatusChange?.({ kind: "idle" });
    } catch (error) {
      onWriteStatusChange?.({
        kind: "error",
        message: error instanceof Error ? error.message : "加载配置失败",
      });
    } finally {
      setLoading(false);
    }
  }, [onWriteStatusChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setActive(initialPage);
  }, [initialPage]);

  useEffect(() => {
    if (dirtySections.has(active)) {
      onWriteStatusChange?.({ kind: "dirty", message: "配置未保存" });
    }
  }, [active, dirtySections, onWriteStatusChange]);

  const merged = useMemo(() => mergeConfig(DEFAULT_CONFIG, config), [config]);
  const profiles = useMemo(
    () => merged.models?.profiles ?? {},
    [merged.models?.profiles],
  );
  const activeModelName = str(merged.serve?.model);
  const currentModelName =
    selectedProfile && profiles[selectedProfile]
      ? selectedProfile
      : activeModelName && profiles[activeModelName]
        ? activeModelName
        : (firstKey(profiles) ?? "");
  const currentModel = currentModelName
    ? (profiles[currentModelName] ?? {})
    : {};

  useEffect(() => {
    if (selectedProfile && profiles[selectedProfile]) return;
    setSelectedProfile(
      activeModelName && profiles[activeModelName]
        ? activeModelName
        : (firstKey(profiles) ?? ""),
    );
  }, [activeModelName, profiles, selectedProfile]);

  async function saveSection(section: ConfigPage, nextConfig: QiongqiConfig) {
    const version = ++saveVersionRef.current;
    const cleanConfig = normalizeConfigForSave(nextConfig);
    setSaving(true);
    onWriteStatusChange?.({ kind: "writing", message: "配置写入中" });
    try {
      if (section === "models") {
        await saveFullConfig(cleanConfig as Record<string, unknown>);
      } else {
        const target = sectionToSave(section, cleanConfig);
        await saveConfigSection(target.section, target.data);
      }
      if (section === "models") {
        await queryClient.invalidateQueries({ queryKey: ["models"] });
      }
      if (version === saveVersionRef.current) {
        setDirtySections((prev) => {
          const next = new Set(prev);
          next.delete(section);
          return next;
        });
        onWriteStatusChange?.({ kind: "success", message: "配置已生效" });
      }
    } catch (error) {
      if (version !== saveVersionRef.current) return;
      onWriteStatusChange?.({
        kind: "error",
        message: error instanceof Error ? error.message : "配置保存失败，已重新加载",
      });
      try {
        setConfig(mergeConfig(DEFAULT_CONFIG, (await loadConfig()) as QiongqiConfig));
        setDirtySections(new Set());
      } catch {
        // Keep the original write error visible in the settings header.
      }
    } finally {
      if (version === saveVersionRef.current) {
        setSaving(false);
      }
    }
  }

  function updateConfigDraft(
    section: ConfigPage,
    recipe: (current: QiongqiConfig) => QiongqiConfig,
  ) {
    setConfig((prev) => {
      return mergeConfig(DEFAULT_CONFIG, recipe(prev));
    });
    setDirtySections((prev) => {
      if (prev.has(section)) return prev;
      const next = new Set(prev);
      next.add(section);
      return next;
    });
    onWriteStatusChange?.({ kind: "dirty", message: "配置未保存" });
  }

  async function saveCurrentSection() {
    await saveSection(active, mergeConfig(DEFAULT_CONFIG, config));
  }

  async function discardCurrentSection() {
    await refresh();
  }

  const updateServeNested = (key: "storage" | "observability", value: unknown) => {
    const section: ConfigPage = key === "storage" ? "storage" : "observability";
    updateConfigDraft(section, (prev) => ({
      ...prev,
      serve: { ...(prev.serve ?? {}), [key]: value },
    }));
  };
  const updateCapability = (key: keyof NonNullable<QiongqiConfig["capabilities"]>, value: unknown) => {
    updateConfigDraft(key, (prev) => ({
      ...prev,
      capabilities: { ...(prev.capabilities ?? {}), [key]: value },
    }));
  };
  const updateModel = (key: string, value: unknown) => {
    if (!currentModelName) return;
    updateConfigDraft("models", (prev) => ({
      ...prev,
      models: {
        ...(prev.models ?? {}),
        profiles: {
          ...(prev.models?.profiles ?? {}),
          [currentModelName]: {
            ...(prev.models?.profiles?.[currentModelName] ?? {}),
            [key]: value,
          },
        },
      },
    }));
  };

  const addProfile = () => {
    const base = "new-profile";
    let name = base;
    let index = 2;
    while (profiles[name]) {
      name = `${base}-${index++}`;
    }
    updateConfigDraft("models", (prev) => ({
      ...prev,
      models: {
        ...(prev.models ?? {}),
        profiles: {
          ...(prev.models?.profiles ?? {}),
          [name]: {
            providerModel: name,
            inputModalities: ["text"],
            outputModalities: ["text"],
            supportsToolCalling: true,
            messageParts: ["text"],
            endpointFormat: "openai_compatible",
          },
        },
      },
    }));
    setSelectedProfile(name);
  };

  const deleteProfile = () => {
    if (!currentModelName) return;
    const entries = Object.entries(config.models?.profiles ?? {}).filter(
      ([name]) => name !== currentModelName,
    );
    const nextProfiles = Object.fromEntries(entries);
    const nextActive = activeModelName === currentModelName ? firstKey(nextProfiles) : activeModelName;
    updateConfigDraft("models", (prev) => ({
      ...prev,
      serve: withOptionalModel(prev.serve, nextActive),
      models: { ...(prev.models ?? {}), profiles: nextProfiles },
    }));
    setSelectedProfile(nextActive ?? "");
  };

  const section = (() => {
    switch (active) {
      case "models":
        return (
          <Section title="模型 Profiles" path="models.profiles">
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="grid min-w-0 flex-1 gap-2">
                  <label className={labelCls}>Profile</label>
                  <Select value={currentModelName} onValueChange={setSelectedProfile}>
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="选择模型 profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(profiles).map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={addProfile}>
                  添加 Profile
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={!currentModelName || Object.keys(profiles).length <= 1}
                  onClick={deleteProfile}
                >
                  删除 Profile
                </Button>
              </div>
              <div className="grid gap-2">
                <label className={labelCls}>profile key</label>
                <Input
                  value={currentModelName}
                  onChange={(event) => {
                    const renamed = renameProfile(config, currentModelName, event.target.value);
                    if (!renamed) return;
                    setSelectedProfile(renamed.name);
                    updateConfigDraft("models", () => renamed.config);
                  }}
                  className="font-mono"
                />
              </div>
            </div>
            <FieldGrid>
              <TextField label="providerModel" value={str(currentModel.providerModel)} onChange={(v) => updateModel("providerModel", v)} />
              <TextField label="baseUrl" value={str(currentModel.baseUrl)} onChange={(v) => updateModel("baseUrl", v)} />
              <TextField label="apiKey" value={str(currentModel.apiKey)} onChange={(v) => updateModel("apiKey", v)} />
              <SelectField
                label="协议类型"
                value={protocolValue(currentModel.endpointFormat)}
                options={["openai_compatible", "anthropic_compatible", "responses"]}
                optionLabels={{
                  openai_compatible: "OpenAI 兼容协议 - 后端会按协议自动拼接 /v1/chat/completions",
                  anthropic_compatible: "Anthropic 兼容协议 - 后端会按协议自动拼接 /v1/messages",
                  responses: "OpenAI Responses API - 后端会按协议自动拼接 /v1/responses",
                }}
                onChange={(v) => updateModel("endpointFormat", v)}
              />
              <p className="text-muted-foreground text-xs md:col-span-2">
                baseUrl 可填写服务根地址或完整接口地址；后端会按协议自动拼接或替换为对应端点。
                智谱 GLM-5.2/GLM-5 Coding Plan 模型会自动切换到 BigModel/Z.ai 的 coding 或 Anthropic 专用端点。
              </p>
              <NumberField label="contextWindowTokens" value={num(currentModel.contextWindowTokens)} onChange={(v) => updateModel("contextWindowTokens", v)} />
            </FieldGrid>
            <ToggleField label="supportsToolCalling" checked={bool(currentModel.supportsToolCalling)} onChange={(v) => updateModel("supportsToolCalling", v)} />
            <ListField label="aliases" value={stringArray(currentModel.aliases)} onChange={(v) => updateModel("aliases", v)} />
            <ListField label="inputModalities" value={stringArray(currentModel.inputModalities)} onChange={(v) => updateModel("inputModalities", v)} />
            <ListField label="outputModalities" value={stringArray(currentModel.outputModalities)} onChange={(v) => updateModel("outputModalities", v)} />
            <ListField label="messageParts" value={stringArray(currentModel.messageParts)} onChange={(v) => updateModel("messageParts", v)} />
            <JsonEditor label="contextCompaction" value={currentModel.contextCompaction ?? {}} onChange={(v) => updateModel("contextCompaction", v)} />
          </Section>
        );
      case "contextCompaction":
        return (
          <ObjectSection
            title="上下文压缩"
            path="contextCompaction"
            value={merged.contextCompaction ?? {}}
            fields={[
              ["defaultSoftThreshold", "number"],
              ["defaultHardThreshold", "number"],
              ["summaryMode", "select:heuristic,model"],
              ["summaryTimeoutMs", "number"],
              ["summaryMaxTokens", "number"],
              ["summaryInputMaxBytes", "number"],
            ]}
            onChange={(value) => updateConfigDraft("contextCompaction", (prev) => ({ ...prev, contextCompaction: value }))}
          />
        );
      case "storage":
        return (
          <Section title="存储" path="serve.storage">
            <SelectField label="backend" value={str((merged.serve?.storage as JsonObject)?.backend)} options={["hybrid", "file"]} onChange={(v) => updateServeNested("storage", { ...(asObject(merged.serve?.storage)), backend: v })} />
            <TextField label="sqlitePath" value={str((merged.serve?.storage as JsonObject)?.sqlitePath)} onChange={(v) => updateServeNested("storage", { ...(asObject(merged.serve?.storage)), sqlitePath: v })} />
            <JsonEditor label="完整 serve.storage" value={merged.serve?.storage ?? {}} onChange={(v) => updateServeNested("storage", v)} />
          </Section>
        );
      case "observability":
        return <JsonOnlySection title="观测" path="serve.observability" value={merged.serve?.observability ?? {}} onChange={(value) => updateServeNested("observability", value)} />;
      case "mcp":
        return <CapabilityMcp value={merged.capabilities?.mcp ?? {}} onChange={(value) => updateCapability("mcp", value)} />;
      case "web":
        return <CapabilityWeb value={merged.capabilities?.web ?? {}} onChange={(value) => updateCapability("web", value)} />;
      case "skills":
        return <JsonOnlySection title="技能" path="capabilities.skills" value={merged.capabilities?.skills ?? {}} onChange={(value) => updateCapability("skills", value)} />;
      case "subagents":
        return <CapabilitySubagents value={merged.capabilities?.subagents ?? {}} onChange={(value) => updateCapability("subagents", value)} />;
    }
  })();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
            <Settings2Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">QiongQi 引擎配置</h3>
            <p className="text-muted-foreground text-xs">
              直接读写 QiongqiConfigSchema 的用户可操作项；模型选择会自动切换运行时核心。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirtySections.has(active) && (
            <Button
              size="sm"
              variant="outline"
              onClick={discardCurrentSection}
              disabled={loading || saving}
            >
              放弃修改
            </Button>
          )}
          <Button
            size="sm"
            onClick={saveCurrentSection}
            disabled={loading || saving || !dirtySections.has(active)}
          >
            {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            保存当前分组
          </Button>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading || saving}>
            {loading ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            刷新
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 gap-4">
        {showNav && (
          <nav className="w-48 shrink-0 space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const selected = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item.id)}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    selected
                      ? "bg-cyan-500/10 font-medium text-cyan-600 dark:text-cyan-400"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        <ScrollArea className="min-h-[420px] min-w-0 flex-1 rounded-lg border">
          <div className="space-y-4 p-5">
            {loading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                加载 QiongQi 配置...
              </div>
            ) : (
              section
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function Section({ title, path, children }: { title: string; path: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className={hintCls}>
          schema path: <code>{path}</code>
        </p>
      </div>
      {children}
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <label className={labelCls}>{label}</label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="font-mono text-sm" />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="grid gap-2">
      <label className={labelCls}>{label}</label>
      <Input
        type="number"
        value={String(value)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="font-mono text-sm"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <label className={labelCls}>{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </SelectItem>
        ))}
      </SelectContent>
      </Select>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
      <label className={labelCls}>{label}</label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  const joined = value.join("\n");

  return (
    <div className="grid gap-2">
      <label className={labelCls}>{label}</label>
      <Textarea value={joined} onChange={(event) => onChange(lines(event.target.value))} className="min-h-20 font-mono text-xs" />
      <p className={hintCls}>每行一个值</p>
    </div>
  );
}

function JsonEditor({ label, value, onChange }: { label: string; value: unknown; onChange: (value: unknown) => void }) {
  const [draft, setDraft] = useState(formatJson(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(formatJson(value));
    setError(null);
  }, [value]);

  return (
    <div className="grid gap-2">
      <label className={labelCls}>{label}</label>
      <Textarea
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          try {
            onChange(JSON.parse(nextDraft));
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "JSON 解析失败");
          }
        }}
        className="min-h-36 font-mono text-xs"
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function ObjectSection({ title, path, value, fields, onChange }: {
  title: string;
  path: string;
  value: JsonObject;
  fields: Array<[string, "number" | `select:${string}`]>;
  onChange: (value: JsonObject) => void;
}) {
  const update = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  return (
    <Section title={title} path={path}>
      <FieldGrid>
        {fields.map(([key, kind]) =>
          kind === "number" ? (
            <NumberField key={key} label={key} value={num(value[key])} onChange={(v) => update(key, v)} />
          ) : (
            <SelectField key={key} label={key} value={str(value[key])} options={kind.slice(7).split(",")} onChange={(v) => update(key, v)} />
          ),
        )}
      </FieldGrid>
      <JsonEditor label={`完整 ${path}`} value={value} onChange={(v) => onChange(asObject(v))} />
    </Section>
  );
}

function JsonOnlySection({ title, path, value, onChange }: { title: string; path: string; value: unknown; onChange: (value: JsonObject) => void }) {
  return (
    <Section title={title} path={path}>
      <JsonEditor label={`完整 ${path}`} value={value} onChange={(v) => onChange(asObject(v))} />
    </Section>
  );
}

function CapabilityMcp({ value, onChange }: { value: JsonObject; onChange: (value: JsonObject) => void }) {
  return (
    <Section title="MCP 运行时" path="capabilities.mcp">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">MCP 工具管理</p>
          <p className={hintCls}>
            这里是引擎级高级配置。新增、编辑、删除 MCP 服务器请使用工作区里的 MCP 工具页面，保存后会刷新运行时工具目录。
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/workspace/mcp">打开 MCP 工具管理</Link>
        </Button>
      </div>
      <JsonEditor label="完整 capabilities.mcp" value={value} onChange={(v) => onChange(asObject(v))} />
    </Section>
  );
}

function CapabilityWeb({ value, onChange }: { value: JsonObject; onChange: (value: JsonObject) => void }) {
  const update = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  const enabled = bool(value.enabled);
  const fetchEnabled = bool(value.fetchEnabled);
  const searchEnabled = bool(value.searchEnabled);
  return (
    <Section title="Web 能力" path="capabilities.web">
      <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">内置 Web 工具</p>
            <p className={hintCls}>
              这里控制 qiongqi 原生的 web_fetch / web_search。具备网页访问能力的 MCP 服务器仍在 MCP 工具页配置，保存后会共同进入运行时工具目录。
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/workspace/mcp">查看 MCP Web 工具</Link>
          </Button>
        </div>
        <div className="grid gap-2 rounded-lg border bg-background/60 p-3 sm:grid-cols-3">
          <RuntimePill label="Web 总开关" active={enabled} />
          <RuntimePill label="web_fetch" active={enabled && fetchEnabled} />
          <RuntimePill label="web_search" active={enabled && searchEnabled} />
        </div>
      </div>
      <ToggleField label="enabled" checked={enabled} onChange={(v) => update("enabled", v)} />
      <ToggleField label="fetchEnabled" checked={fetchEnabled} onChange={(v) => update("fetchEnabled", v)} />
      <ToggleField label="searchEnabled" checked={searchEnabled} onChange={(v) => update("searchEnabled", v)} />
      <TextField label="provider" value={str(value.provider)} onChange={(v) => update("provider", v)} />
      <ListField label="allowDomains" value={stringArray(value.allowDomains)} onChange={(v) => update("allowDomains", v)} />
      <ListField label="denyDomains" value={stringArray(value.denyDomains)} onChange={(v) => update("denyDomains", v)} />
      <p className={hintCls}>
        allowDomains 为空时默认允许所有 HTTP/HTTPS 域名；denyDomains 会优先阻断。MCP 工具的域名策略由对应 MCP server 自己负责。
      </p>
      <JsonEditor label="完整 capabilities.web" value={value} onChange={(v) => onChange(asObject(v))} />
    </Section>
  );
}

function RuntimePill({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
          active
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground",
        )}
      >
        {active ? "启用" : "关闭"}
      </span>
    </div>
  );
}

function CapabilitySubagents({ value, onChange }: { value: JsonObject; onChange: (value: JsonObject) => void }) {
  const update = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  return (
    <Section title="智能体协作" path="capabilities.subagents">
      <ToggleField label="enabled" checked={bool(value.enabled)} onChange={(v) => update("enabled", v)} />
      <FieldGrid>
        <NumberField label="maxParallel" value={num(value.maxParallel)} onChange={(v) => update("maxParallel", v)} />
        <NumberField label="maxChildRuns" value={num(value.maxChildRuns)} onChange={(v) => update("maxChildRuns", v)} />
      </FieldGrid>
      <p className={hintCls}>当前 KWorks 默认仍使用 classic 编排；这里保留多智能体能力配置入口。</p>
    </Section>
  );
}

function sectionToSave(section: ConfigPage, config: QiongqiConfig): { section: string; data: unknown } {
  switch (section) {
    case "storage":
      return { section: "storage", data: config.serve?.storage ?? {} };
    case "observability":
      return { section: "observability", data: config.serve?.observability ?? {} };
    case "mcp":
    case "web":
    case "skills":
    case "subagents":
      return { section, data: config.capabilities?.[section] ?? {} };
    default:
      return { section, data: config[section as keyof QiongqiConfig] ?? {} };
  }
}

function mergeConfig(base: QiongqiConfig, next: QiongqiConfig): QiongqiConfig {
  return deepMerge(base, next) as QiongqiConfig;
}

function deepMerge(base: unknown, next: unknown): unknown {
  if (Array.isArray(base) || Array.isArray(next)) return next ?? base;
  if (!isPlainObject(base) || !isPlainObject(next)) return next ?? base;
  const out: JsonObject = { ...base };
  for (const [key, value] of Object.entries(next)) {
    out[key] = deepMerge((base)[key], value);
  }
  return out;
}

function renameProfile(
  config: QiongqiConfig,
  currentName: string,
  nextName: string,
): { name: string; config: QiongqiConfig } | null {
  const clean = nextName.trim();
  if (!clean || !currentName || clean === currentName) return null;
  const profiles = config.models?.profiles ?? {};
  const currentValue = profiles[currentName] ?? {};
  const activeModelName = str(config.serve?.model);
  return {
    name: clean,
    config: {
      ...config,
      serve: {
        ...(config.serve ?? {}),
        ...(activeModelName === currentName
          ? { model: clean }
          : activeModelName
            ? { model: activeModelName }
            : {}),
      },
      models: {
        ...(config.models ?? {}),
        profiles: {
          [clean]: currentValue,
          ...Object.fromEntries(Object.entries(profiles).filter(([key]) => key !== currentName)),
        },
      },
    },
  };
}

function asObject(value: unknown): JsonObject {
  return isPlainObject(value) ? value : {};
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function withOptionalModel(
  serve: JsonObject | undefined,
  modelName: string | undefined,
): JsonObject {
  const next = { ...(serve ?? {}) };
  if (modelName?.trim()) {
    next.model = modelName.trim();
  } else {
    delete next.model;
  }
  return next;
}

function normalizeConfigForSave(config: QiongqiConfig): QiongqiConfig {
  const next = clone(config);
  if (next.serve) {
    next.serve = omitEmptyOptionalStrings(next.serve, [
      "model",
      "baseUrl",
      "apiKey",
      "runtimeToken",
      "dataDir",
    ]);
  }
  if (next.models?.profiles) {
    next.models = {
      ...next.models,
      profiles: Object.fromEntries(
        Object.entries(next.models.profiles).map(([name, profile]) => [
          name,
          omitEmptyOptionalStrings(profile, [
            "providerModel",
            "baseUrl",
            "apiKey",
            "endpointFormat",
          ]),
        ]),
      ),
    };
  }
  return next;
}

function omitEmptyOptionalStrings(
  value: JsonObject,
  keys: readonly string[],
): JsonObject {
  const next = { ...value };
  for (const key of keys) {
    if (typeof next[key] === "string" && next[key].trim() === "") {
      delete next[key];
    }
  }
  return next;
}

function protocolValue(value: unknown): string {
  const normalized = str(value).trim().toLowerCase().replace(/^\/+/, "");
  switch (normalized) {
    case "anthropic":
    case "anthropic-compatible":
    case "anthropic_compatible":
    case "anthropic messages":
    case "anthropic-messages":
    case "anthropic_messages":
    case "message":
    case "messages":
    case "v1/messages":
      return "anthropic_compatible";
    case "response":
    case "responses":
    case "v1/responses":
      return "responses";
    case "openai":
    case "openai-compatible":
    case "openai_compatible":
    case "openai chat completions":
    case "openai-chat-completions":
    case "openai_chat_completions":
    case "chat":
    case "chat-completions":
    case "chat_completions":
    case "chat/completions":
    case "v1/chat/completions":
    default:
      return "openai_compatible";
  }
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function bool(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function firstKey(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  return Object.keys(value)[0];
}
