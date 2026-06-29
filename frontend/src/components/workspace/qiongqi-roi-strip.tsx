"use client";

import { BarChart3Icon, GaugeIcon, TrendingUpIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchQiongQiThreadUsage,
  type QiongQiThreadUsage,
} from "@/core/api/token-usage";
import {
  accumulateUsage,
  formatTokenCount,
  type TokenUsage,
} from "@/core/messages/usage";
import type { Message } from "@/core/threads/qiongqi-types";
import { cn } from "@/lib/utils";

const ROI_USAGE_RETRY_LIMIT = 5;
const ROI_USAGE_RETRY_DELAY_MS = 1200;

export interface QiongQiRoiSummary {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  outputShare: number;
  efficiencyScore: number;
  savedTokensEstimate: number;
  cachedTokens: number;
  cacheHitTokens: number;
  cacheHitRate: number | null;
  turns: number;
  source: "api" | "messages";
}

export function buildQiongQiRoiSummary(
  usage: TokenUsage | null,
  apiUsage?: QiongQiThreadUsage | null,
): QiongQiRoiSummary {
  const inputTokens = apiUsage?.inputTokens ?? usage?.inputTokens ?? 0;
  const outputTokens = apiUsage?.outputTokens ?? usage?.outputTokens ?? 0;
  const totalTokens =
    apiUsage?.totalTokens ?? usage?.totalTokens ?? inputTokens + outputTokens;
  const savedTokensEstimate = apiUsage
    ? apiUsage.tokenEconomySavingsTokens + apiUsage.cacheHitTokens
    : totalTokens > 0
      ? Math.round(totalTokens * 0.3)
      : 0;
  const outputShare =
    totalTokens > 0 ? Math.round((outputTokens / totalTokens) * 100) : 0;
  const savedShare =
    totalTokens + savedTokensEstimate > 0
      ? savedTokensEstimate / (totalTokens + savedTokensEstimate)
      : 0;
  const efficiencyScore =
    totalTokens > 0
      ? Math.max(
          0,
          Math.min(100, Math.round(35 + outputShare * 0.35 + savedShare * 65)),
        )
      : 0;

  return {
    totalTokens,
    inputTokens,
    outputTokens,
    outputShare,
    efficiencyScore,
    savedTokensEstimate,
    cachedTokens: apiUsage?.cachedTokens ?? 0,
    cacheHitTokens: apiUsage?.cacheHitTokens ?? 0,
    cacheHitRate: apiUsage?.cacheHitRate ?? null,
    turns: apiUsage?.turns ?? 0,
    source: apiUsage ? "api" : "messages",
  };
}

export function isSelectedWorkspaceRoot(
  workspaceRoot: unknown,
): workspaceRoot is string {
  if (typeof workspaceRoot !== "string") {
    return false;
  }
  const trimmed = workspaceRoot.trim();
  return trimmed.length > 0 && trimmed !== ".";
}

export function getWorkspaceRootDisplayName(workspaceRoot: unknown): string {
  if (!isSelectedWorkspaceRoot(workspaceRoot)) {
    return "未设置工作目录";
  }
  const trimmed = workspaceRoot.trim().replace(/\/+$/, "");
  return trimmed.split("/").filter(Boolean).at(-1) ?? trimmed;
}

export function shouldRetryQiongQiRoiUsageFetch({
  apiUsageReady,
  messageCount,
  attempt,
}: {
  apiUsageReady: boolean;
  messageCount: number;
  attempt: number;
}): boolean {
  return !apiUsageReady && messageCount > 0 && attempt < ROI_USAGE_RETRY_LIMIT;
}

export function QiongQiRoiStrip({
  className,
  messages,
  threadId,
}: {
  className?: string;
  messages: Message[];
  threadId?: string;
}) {
  const [apiUsage, setApiUsage] = useState<QiongQiThreadUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resolvedThreadId = threadId?.trim();
    if (!resolvedThreadId || resolvedThreadId === "new") {
      setApiUsage(null);
      return;
    }

    const loadUsage = (attempt: number) => {
      fetchQiongQiThreadUsage(resolvedThreadId)
        .then((usage) => {
          if (cancelled) return;
          setApiUsage(usage);
          if (
            !usage &&
            shouldRetryQiongQiRoiUsageFetch({
              apiUsageReady: false,
              messageCount: messages.length,
              attempt,
            })
          ) {
            timer = setTimeout(
              () => loadUsage(attempt + 1),
              ROI_USAGE_RETRY_DELAY_MS,
            );
          }
        })
        .catch(() => {
          if (cancelled) return;
          setApiUsage(null);
          if (
            shouldRetryQiongQiRoiUsageFetch({
              apiUsageReady: false,
              messageCount: messages.length,
              attempt,
            })
          ) {
            timer = setTimeout(
              () => loadUsage(attempt + 1),
              ROI_USAGE_RETRY_DELAY_MS,
            );
          }
        });
    };

    loadUsage(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [threadId, messages.length]);

  const summary = useMemo(
    () => buildQiongQiRoiSummary(accumulateUsage(messages), apiUsage),
    [apiUsage, messages],
  );
  const hasUsage = summary.totalTokens > 0;

  return (
    <div
      className={cn(
        "group/qiongqi-roi relative z-10 h-5 w-full rounded-b-xl border-x border-b bg-background/70 px-3 text-[10px] text-muted-foreground shadow-sm backdrop-blur",
        className,
      )}
      data-testid="qiongqi-roi-strip"
    >
      <div className="flex h-full min-w-0 items-center gap-3 overflow-hidden">
        <span className="flex shrink-0 items-center gap-1 font-medium text-foreground/80">
          <GaugeIcon className="size-3 text-emerald-500" />
          QiongQi ROI
        </span>
        <span className="truncate">
          Token {hasUsage ? formatTokenCount(summary.totalTokens) : "-"}
        </span>
        <span className="hidden truncate sm:inline">
          效率 {hasUsage ? `${summary.efficiencyScore}%` : "-"}
        </span>
        <div className="h-1 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500/80"
            style={{ width: `${hasUsage ? summary.efficiencyScore : 8}%` }}
          />
        </div>
        <span className="hidden shrink-0 md:inline">
          节省 {hasUsage ? formatTokenCount(summary.savedTokensEstimate) : "-"}
        </span>
      </div>

      <div className="pointer-events-none absolute right-0 bottom-6 w-[min(34rem,calc(100vw-2rem))] translate-y-1 rounded-lg border bg-popover p-3 text-popover-foreground opacity-0 shadow-xl transition-all duration-150 group-hover/qiongqi-roi:pointer-events-auto group-hover/qiongqi-roi:translate-y-0 group-hover/qiongqi-roi:opacity-100 group-focus-within/qiongqi-roi:pointer-events-auto group-focus-within/qiongqi-roi:translate-y-0 group-focus-within/qiongqi-roi:opacity-100">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium">穷奇 ROI 统计</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {summary.source === "api"
                ? "来自穷奇 usage 服务的当前会话统计"
                : "等待后端 usage，暂用流式消息统计"}
            </div>
          </div>
          <BarChart3Icon className="size-4 text-emerald-500" />
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <RoiMetric label="总 Token" value={formatMetric(summary.totalTokens)} />
          <RoiMetric label="轮次" value={summary.turns > 0 ? String(summary.turns) : "-"} />
          <RoiMetric label="效率评分" value={hasUsage ? `${summary.efficiencyScore}%` : "-"} />
          <RoiMetric
            label="已节省"
            value={formatMetric(summary.savedTokensEstimate)}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[9rem_1fr]">
          <div className="flex items-center justify-center">
            <div
              className="grid size-24 place-items-center rounded-full"
              style={{
                background: `conic-gradient(rgb(16 185 129 / 0.85) ${summary.outputShare}%, hsl(var(--muted)) 0)`,
              }}
            >
              <div className="grid size-16 place-items-center rounded-full bg-popover text-center">
                <div>
                  <div className="text-base font-semibold">
                    {hasUsage ? `${summary.outputShare}%` : "-"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">产出占比</div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <RoiBar
              label="输入消耗"
              value={summary.inputTokens}
              max={Math.max(summary.inputTokens, summary.outputTokens, 1)}
            />
            <RoiBar
              label="输出产出"
              value={summary.outputTokens}
              max={Math.max(summary.inputTokens, summary.outputTokens, 1)}
            />
            <RoiBar
              label="缓存命中"
              value={summary.cacheHitTokens}
              max={Math.max(summary.savedTokensEstimate, 1)}
              accent
            />
            <RoiBar
              label="优化收益"
              value={summary.savedTokensEstimate}
              max={Math.max(summary.totalTokens, 1)}
              accent
            />
            <div className="text-[11px] text-muted-foreground">
              Cache hit{" "}
              {summary.cacheHitRate == null
                ? "-"
                : `${Math.round(summary.cacheHitRate * 100)}%`}
              ，cached {formatMetric(summary.cachedTokens)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoiMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/50 px-2.5 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-1 text-sm font-semibold">
        <TrendingUpIcon className="size-3 text-emerald-500" />
        {value}
      </div>
    </div>
  );
}

function RoiBar({
  label,
  value,
  max,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  accent?: boolean;
}) {
  const width = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 3;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{formatMetric(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            accent ? "bg-cyan-500/80" : "bg-emerald-500/80",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function formatMetric(value: number): string {
  return value > 0 ? formatTokenCount(value) : "-";
}
