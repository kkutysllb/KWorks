"use client";

import { HelpCircleIcon, Settings2Icon, TerminalIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/core/i18n/hooks";
import type { MCPServerConfig } from "@/core/mcp/types";

import { McpHelp } from "./mcp-help";

const TYPE_GRADIENTS: Record<string, string> = {
  stdio: "from-emerald-400 to-teal-400",
  sse: "from-blue-400 to-cyan-400",
  http: "from-purple-400 to-fuchsia-400",
  "streamable-http": "from-purple-400 to-fuchsia-400",
};

const TYPE_ICONS: Record<string, string> = {
  stdio: "bg-emerald-500/10 text-emerald-500",
  sse: "bg-blue-500/10 text-blue-500",
  http: "bg-purple-500/10 text-purple-500",
  "streamable-http": "bg-purple-500/10 text-purple-500",
};

const labelCls =
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70";
const hintCls = "text-muted-foreground text-xs";
const sectionTitleCls =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground/70";

interface McpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string | null;
  config: MCPServerConfig | null;
  onSave: (
    name: string,
    isNew: boolean,
    config: MCPServerConfig,
  ) => Promise<void>;
}

/** Parse multi-line text (one entry per line, `KEY=value` or `Header: value`) into a Record. */
function parseMultiline(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sep = trimmed.includes("=") ? "=" : ":";
    const idx = trimmed.indexOf(sep);
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (key) result[key] = value;
    }
  }
  return result;
}

/** Serialize a Record to multi-line text. */
function formatMultiline(record: Record<string, string> | undefined): string {
  if (!record || Object.keys(record).length === 0) return "";
  return Object.entries(record)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

/** Check if any value in a Record contains the backend mask pattern ``***``. */
function hasMaskedValues(record: Record<string, string> | undefined): boolean {
  if (!record) return false;
  return Object.values(record).some((v) => v.includes("***"));
}

export function McpDialog({
  open,
  onOpenChange,
  name,
  config,
  onSave,
}: McpDialogProps) {
  const { t } = useI18n();
  const isEdit = !!name && !!config;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [serverName, setServerName] = useState("");
  const [transportType, setTransportType] = useState("stdio");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const [envText, setEnvText] = useState("");
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [trustScope, setTrustScope] = useState<"workspace" | "user">("workspace");
  const [trustedRootsText, setTrustedRootsText] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("30000");

  const [errFields, setErrFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      if (isEdit && config) {
        setServerName(name);
        setTransportType(
          config.transport === "streamable-http" ? "http" : config.transport ?? "stdio",
        );
        setCommand(config.command ?? "");
        setArgsText((config.args ?? []).join("\n"));
        setEnvText(formatMultiline(config.env));
        setUrl(config.url ?? "");
        setHeadersText(formatMultiline(config.headers));
        setEnabled(config.enabled);
        setTrustScope(config.trustScope === "user" ? "user" : "workspace");
        setTrustedRootsText((config.trustedWorkspaceRoots ?? []).join("\n"));
        setTimeoutMs(String(config.timeoutMs ?? 30000));
      } else {
        setServerName("");
        setTransportType("stdio");
        setCommand("");
        setArgsText("");
        setEnvText("");
        setUrl("");
        setHeadersText("");
        setEnabled(true);
        setTrustScope("workspace");
        setTrustedRootsText("");
        setTimeoutMs("30000");
      }
      setShowHelp(false);
      setError(null);
      setErrFields(new Set());
    }
  }, [open, isEdit, name, config]);

  const isHttpTransport = transportType === "sse" || transportType === "http" || transportType === "streamable-http";

  // Detect if env/headers contain backend-masked values (for security hint)
  const envHasMasked = isEdit && hasMaskedValues(config?.env);
  const headersHasMasked = isEdit && hasMaskedValues(config?.headers);

  const handleSave = async () => {
    const missing = new Set<string>();
    if (!serverName.trim()) missing.add("name");
    if (transportType === "stdio" && !command.trim()) missing.add("command");
    if (isHttpTransport && !url.trim()) missing.add("url");
    if (trustScope === "workspace" && !trustedRootsText.trim()) {
      missing.add("trustedWorkspaceRoots");
    }
    setErrFields(missing);
    if (missing.size > 0) return;

    const transport =
      transportType === "http" ? "streamable-http" : transportType;
    const serverConfig: MCPServerConfig = {
      enabled,
      transport: transport as MCPServerConfig["transport"],
      args: [],
      env: {},
      headers: {},
      trustScope,
      trustedWorkspaceRoots:
        trustScope === "workspace"
          ? trustedRootsText
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      timeoutMs: Number(timeoutMs) > 0 ? Number(timeoutMs) : 30000,
    };

    if (transportType === "stdio") {
      serverConfig.command = command.trim();
      serverConfig.args = argsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      serverConfig.env = parseMultiline(envText);
    }

    if (isHttpTransport) {
      serverConfig.url = url.trim();
      serverConfig.headers = parseMultiline(headersText);
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(serverName.trim(), !isEdit, serverConfig);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = (field: string) =>
    errFields.has(field) ? "border-destructive" : "";

  const gradient =
    TYPE_GRADIENTS[transportType] ?? "from-amber-400 to-orange-400";
  const iconColor =
    TYPE_ICONS[transportType] ?? "bg-amber-500/10 text-amber-500";

  if (showHelp) {
    return <McpHelp onBack={() => setShowHelp(false)} />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-xl">
        {/* Accent bar */}
        <div
          className={`h-1.5 w-full rounded-t-lg bg-gradient-to-r ${gradient}`}
        />

        <DialogHeader className="px-6 pt-5">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconColor}`}
            >
              <TerminalIcon className="h-4 w-4" />
            </span>
            {isEdit ? t.mcp.editServer : t.mcp.addServer}
          </DialogTitle>
          <DialogDescription className="pl-10">
            {isEdit ? `"${name}"` : t.mcp.description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* ── 基本信息 ── */}
          <div className="space-y-3">
            <p className={sectionTitleCls}>
              <Settings2Icon className="mr-1.5 inline h-3.5 w-3.5" />
              基本信息
            </p>
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-2">
                <label htmlFor="mcp-name" className={labelCls}>
                  服务器名称 <span className="text-amber-500 font-bold">*</span>
                </label>
                <Input
                  id="mcp-name"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="github"
                  disabled={isEdit}
                  className={fieldCls("name")}
                />
                <p className={hintCls}>字母、数字和连字符，如 github、filesystem</p>
              </div>

              <div className="grid gap-2">
                <label htmlFor="mcp-type" className={labelCls}>
                  {t.mcp.type}
                </label>
                <Select
                  value={transportType}
                  onValueChange={setTransportType}
                  disabled={isEdit}
                >
                  <SelectTrigger id="mcp-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stdio">{t.mcp.typeStdio}</SelectItem>
                    <SelectItem value="sse">{t.mcp.typeSse}</SelectItem>
                    <SelectItem value="http">{t.mcp.typeHttp}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 传输配置 ── */}
          <div className="space-y-3">
            <p className={sectionTitleCls}>
              <TerminalIcon className="mr-1.5 inline h-3.5 w-3.5" />
              传输配置
            </p>
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              {transportType === "stdio" ? (
                <>
                  <div className="grid gap-2">
                    <label htmlFor="mcp-cmd" className={labelCls}>
                      {t.mcp.command}{" "}
                      <span className="text-amber-500 font-bold">*</span>
                    </label>
                    <Input
                      id="mcp-cmd"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="npx"
                      className={fieldCls("command")}
                    />
                    <p className={hintCls}>{t.mcp.commandHint}</p>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="mcp-args" className={labelCls}>
                      {t.mcp.args}
                    </label>
                    <Textarea
                      id="mcp-args"
                      value={argsText}
                      onChange={(e) => setArgsText(e.target.value)}
                      placeholder="-y\n@modelcontextprotocol/server-github"
                      rows={3}
                      className="font-mono text-xs"
                    />
                    <p className={hintCls}>{t.mcp.argsHint}</p>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="mcp-env" className={labelCls}>
                      {t.mcp.env}
                    </label>
                    <Textarea
                      id="mcp-env"
                      value={envText}
                      onChange={(e) => setEnvText(e.target.value)}
                      placeholder="GITHUB_TOKEN=$GITHUB_TOKEN"
                      rows={3}
                      className="font-mono text-xs"
                    />
                    <p className={hintCls}>
                      {envHasMasked
                        ? "已保存的凭证已掩码显示（含 ***），修改值将更新，保留掩码值则维持原有配置。"
                        : t.mcp.envHint}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <label htmlFor="mcp-url" className={labelCls}>
                      {t.mcp.url}{" "}
                      <span className="text-amber-500 font-bold">*</span>
                    </label>
                    <Input
                      id="mcp-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://mcp.example.com/sse"
                      className={fieldCls("url")}
                    />
                    <p className={hintCls}>{t.mcp.urlHint}</p>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="mcp-headers" className={labelCls}>
                      {t.mcp.headers}
                    </label>
                    <Textarea
                      id="mcp-headers"
                      value={headersText}
                      onChange={(e) => setHeadersText(e.target.value)}
                      placeholder="Authorization=Bearer token"
                      rows={3}
                      className="font-mono text-xs"
                    />
                    <p className={hintCls}>
                      {headersHasMasked
                        ? "已保存的凭证已掩码显示（含 ***），修改值将更新，保留掩码值则维持原有配置。"
                        : t.mcp.headersHint}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* ── 安全边界 ── */}
          <div className="space-y-3">
            <p className={sectionTitleCls}>
              <Settings2Icon className="mr-1.5 inline h-3.5 w-3.5" />
              信任边界
            </p>
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-2">
                <label htmlFor="mcp-trust-scope" className={labelCls}>
                  trustScope
                </label>
                <Select
                  value={trustScope}
                  onValueChange={(value) =>
                    setTrustScope(value === "user" ? "user" : "workspace")
                  }
                >
                  <SelectTrigger id="mcp-trust-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">workspace</SelectItem>
                    <SelectItem value="user">user</SelectItem>
                  </SelectContent>
                </Select>
                <p className={hintCls}>
                  workspace 只会在聊天线程选择了匹配的工作目录时暴露工具；user 对当前用户的所有聊天可见。
                </p>
              </div>
              {trustScope === "workspace" && (
                <div className="grid gap-2">
                  <label htmlFor="mcp-roots" className={labelCls}>
                    trustedWorkspaceRoots{" "}
                    <span className="text-amber-500 font-bold">*</span>
                  </label>
                  <Textarea
                    id="mcp-roots"
                    value={trustedRootsText}
                    onChange={(e) => setTrustedRootsText(e.target.value)}
                    placeholder="/Users/libing/kk_Projects/kk_KWorks"
                    rows={3}
                    className={fieldCls("trustedWorkspaceRoots")}
                  />
                  <p className={hintCls}>每行一个允许该 MCP 访问的工作目录；聊天输入框中的工作空间需要落在这些目录内。</p>
                </div>
              )}
              <div className="grid gap-2">
                <label htmlFor="mcp-timeout" className={labelCls}>
                  timeoutMs
                </label>
                <Textarea
                  id="mcp-timeout"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(e.target.value)}
                  rows={1}
                  className="font-mono text-xs"
                />
                <p className={hintCls}>工具调用超时时间，单位毫秒。</p>
              </div>
            </div>
          </div>

          {/* 启用开关 */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-medium">{t.mcp.enabled}</p>
              <p className={hintCls}>
                {enabled ? "服务器已启用，将被加载和使用" : "服务器已禁用"}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* 帮助按钮 */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowHelp(true)}
          >
            <HelpCircleIcon className="mr-1.5 h-4 w-4" />
            {t.mcp.guide}
          </Button>
        </div>

        {error && (
          <p className="mx-6 text-destructive text-sm rounded-md bg-destructive/5 px-3 py-2">
            {error}
          </p>
        )}

        <Separator />

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
            className={`bg-gradient-to-r ${gradient} text-white hover:opacity-90 shadow-sm`}
          >
            {saving ? t.common.loading : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
