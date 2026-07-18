"use client";

import { EyeIcon, EyeOffIcon, KeyRoundIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveFinanceCredentials,
  useFinanceCredentialSettings,
} from "@/core/finance/credentials";

type Source = "user" | "environment" | "missing";

const DEFAULTS = {
  apiBaseUrl: "https://openapi.iwencai.com",
  queryEndpoint: "/v1/query2data",
  comprehensiveEndpoint: "/v1/comprehensive/search",
  webUrl: "https://www.iwencai.com/unifiedwap/chat",
};

export function FinanceDataSourceSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useFinanceCredentialSettings();
  const [tushareToken, setTushareToken] = useState("");
  const [iwencaiApiKey, setIwencaiApiKey] = useState("");
  const [showTushare, setShowTushare] = useState(false);
  const [showIwencai, setShowIwencai] = useState(false);
  const [config, setConfig] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.config) return;
    setConfig({ ...DEFAULTS, ...data.config });
  }, [data]);

  const sourceLabel = (source: Source | undefined) =>
    source === "user" ? "用户配置" : source === "environment" ? "环境变量" : "未配置";

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveFinanceCredentials({
        ...(tushareToken ? { tushareToken } : {}),
        ...(iwencaiApiKey ? { iwencaiApiKey } : {}),
        ...config,
      });
      setTushareToken("");
      setIwencaiApiKey("");
      setConfig({ ...DEFAULTS, ...(saved.config ?? {}) });
      await queryClient.invalidateQueries({ queryKey: ["finance", "credentials"] });
      setMessage("金融数据源配置已保存");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const clearSecret = async (field: "tushareToken" | "iwencaiApiKey") => {
    setSaving(true);
    setMessage(null);
    try {
      await saveFinanceCredentials({ [field]: null });
      await queryClient.invalidateQueries({ queryKey: ["finance", "credentials"] });
      setMessage("凭证已清除");
    } catch (clearError) {
      setMessage(clearError instanceof Error ? clearError.message : "清除失败");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" />正在加载金融数据源配置...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">加载金融数据源配置失败：{error.message}</div>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">金融数据源</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          金融量化技能优先使用官方 Tushare 和 iWencai 接口。凭证按用户隔离保存，不会写入普通模型配置或返回明文。
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRoundIcon className="size-4" />接口凭证</h3>
        <SecretField label="Tushare Token" value={tushareToken} setValue={setTushareToken} visible={showTushare} setVisible={setShowTushare} source={sourceLabel(data?.sources?.tushare)} onClear={() => clearSecret("tushareToken")} />
        <SecretField label="iWencai API Key" value={iwencaiApiKey} setValue={setIwencaiApiKey} visible={showIwencai} setVisible={setShowIwencai} source={sourceLabel(data?.sources?.iwencai)} onClear={() => clearSecret("iwencaiApiKey")} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">iWencai 地址</h3>
        <TextField label="API Base URL" value={config.apiBaseUrl} onChange={(value) => setConfig((current) => ({ ...current, apiBaseUrl: value }))} />
        <TextField label="结构化查询 Endpoint" value={config.queryEndpoint} onChange={(value) => setConfig((current) => ({ ...current, queryEndpoint: value }))} />
        <TextField label="综合搜索 Endpoint" value={config.comprehensiveEndpoint} onChange={(value) => setConfig((current) => ({ ...current, comprehensiveEndpoint: value }))} />
        <TextField label="Web URL" value={config.webUrl} onChange={(value) => setConfig((current) => ({ ...current, webUrl: value }))} />
      </section>

      <div className="flex items-center gap-3 border-t pt-5">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
          保存配置
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}

function SecretField({
  label,
  value,
  setValue,
  visible,
  setVisible,
  source,
  onClear,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  visible: boolean;
  setVisible: (value: boolean) => void;
  source: string;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-xs text-muted-foreground">{source}</span>
      </div>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input type={visible ? "text" : "password"} value={value} onChange={(event) => setValue(event.target.value)} placeholder="输入后保存，当前值不会回填" className="pr-10" />
          <button type="button" className="absolute inset-y-0 right-0 px-3 text-muted-foreground" onClick={() => setVisible(!visible)} aria-label={visible ? "隐藏凭证" : "显示凭证"}>
            {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
        <Button type="button" variant="outline" onClick={onClear}>清除</Button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm"><span className="font-medium">{label}</span><Input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
