"use client";

import { AlertTriangleIcon, CheckCircle2Icon, Edit2Icon, LinkIcon, TerminalIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/core/i18n/hooks";
import type { MCPServerConfig, MCPServerRuntimeStatus } from "@/core/mcp/types";

const TYPE_ICONS: Record<string, string> = {
  stdio: "bg-emerald-500/10 text-emerald-500",
  sse: "bg-blue-500/10 text-blue-500",
  http: "bg-purple-500/10 text-purple-500",
  "streamable-http": "bg-purple-500/10 text-purple-500",
};

const TYPE_LABELS: Record<string, string> = {
  stdio: "STDIO",
  sse: "SSE",
  http: "HTTP",
  "streamable-http": "HTTP",
};

interface McpCardProps {
  name: string;
  config: MCPServerConfig;
  runtimeStatus?: MCPServerRuntimeStatus;
  onEdit: (name: string) => void;
  onDelete: (name: string) => void;
}

export function McpCard({ name, config, runtimeStatus, onEdit, onDelete }: McpCardProps) {
  const { t } = useI18n();

  const transportType =
    config.transport === "streamable-http" ? "streamable-http" : config.transport || "stdio";
  const iconColor = TYPE_ICONS[transportType] ?? "bg-amber-500/10 text-amber-500";
  const typeLabel = TYPE_LABELS[transportType] ?? transportType.toUpperCase();
  const statusText = runtimeStatus
    ? runtimeStatus.status === "connected"
      ? config.trustScope === "workspace"
        ? `${runtimeStatus.toolCount} 个工具，需匹配聊天工作区`
        : `${runtimeStatus.toolCount} 个工具，当前用户可用`
      : runtimeStatus.status === "error"
        ? runtimeStatus.lastError ?? "连接失败"
        : "运行时已禁用"
    : "等待运行时刷新";

  return (
    <div className="group flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-all duration-200 hover:bg-accent/50 hover:shadow-sm">
      {/* Icon */}
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
        <TerminalIcon className="size-4.5" />
      </div>

      {/* Name + details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{name}</span>
          <Badge
            variant={config.enabled ? "default" : "secondary"}
            className={
              config.enabled
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-1.5 py-0"
                : "bg-muted text-muted-foreground text-[10px] px-1.5 py-0"
            }
          >
            {config.enabled ? t.mcp.enabled : t.mcp.disabled}
          </Badge>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${iconColor} border-current/20`}
          >
            {typeLabel}
          </Badge>
        </div>
        <p className="text-muted-foreground/70 mt-0.5 truncate text-xs">
          {config.trustScope === "user"
            ? "用户级信任"
            : `${config.trustedWorkspaceRoots?.length ?? 0} 个可信工作目录`}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
          {runtimeStatus?.status === "connected" ? (
            <CheckCircle2Icon className="size-3 shrink-0 text-emerald-500" />
          ) : runtimeStatus?.status === "error" ? (
            <AlertTriangleIcon className="size-3 shrink-0 text-red-500" />
          ) : null}
          <span className="truncate">{statusText}</span>
        </p>
      </div>

      {/* Transport detail */}
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground/60 font-mono shrink-0 max-w-[260px] truncate">
        {transportType === "stdio" && config.command && (
          <>
            <TerminalIcon className="size-3" />
            <span className="truncate">$ {config.command} {(config.args ?? []).join(" ")}</span>
          </>
        )}
        {(transportType === "sse" || transportType === "http" || transportType === "streamable-http") && config.url && (
          <>
            <LinkIcon className="size-3" />
            <span className="truncate">{config.url}</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:bg-amber-500/10 hover:text-amber-500"
                onClick={() => onEdit(name)}
              >
                <Edit2Icon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.mcp.editServer}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(name)}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.mcp.deleteServer}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
