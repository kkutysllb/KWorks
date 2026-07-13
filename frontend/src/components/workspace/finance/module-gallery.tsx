"use client";

import {
  ArrowLeftRightIcon,
  Building2Icon,
  CandlestickChartIcon,
  CheckCircle2Icon,
  FilterIcon,
  FlaskConicalIcon,
  LayersIcon,
  LineChartIcon,
  type LucideIcon,
  SigmaIcon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useFinanceCredentials } from "@/core/finance/credentials";
import { FINANCE_MODULES, type FinanceModuleIcon } from "@/core/finance/modules";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<FinanceModuleIcon, LucideIcon> = {
  "trending-up": TrendingUpIcon,
  "candlestick-chart": CandlestickChartIcon,
  layers: LayersIcon,
  "arrow-left-right": ArrowLeftRightIcon,
  "line-chart": LineChartIcon,
  "building-2": Building2Icon,
  filter: FilterIcon,
  sigma: SigmaIcon,
  "flask-conical": FlaskConicalIcon,
};

export function FinanceModuleGallery() {
  const router = useRouter();
  const { data: credStatus } = useFinanceCredentials();

  const navigateToModule = (moduleId: string) => {
    router.push(`/workspace/finance/${moduleId}`);
  };

  return (
    <div className="flex size-full flex-col">
      {/* Page header */}
      <div className="relative shrink-0 border-b bg-gradient-to-b from-muted/30 to-transparent">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 size-64 rounded-full bg-amber-500/5 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 size-48 rounded-full bg-orange-500/5 blur-3xl" />
        </div>

        <div className="relative flex items-center justify-between px-6 py-5">
          <div className="space-y-1.5">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <TrendingUpIcon className="h-6 w-6 text-amber-500" />
              <span className="bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                金融量化
              </span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              选择分析模块，使用「小s」金融分析助手进行客观的数据驱动分析。所有数据通过技能获取，绝无编造。
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex size-2 rounded-full bg-amber-400" />
              {FINANCE_MODULES.length} 个分析模块
            </div>
            {credStatus && (
              <div className="flex items-center gap-3 text-[11px]">
                <CredentialBadge
                  label="iWencai"
                  ok={credStatus.iwencai}
                />
                <CredentialBadge
                  label="Tushare"
                  ok={credStatus.tushare}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Module cards grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FINANCE_MODULES.map((module) => {
            const Icon = ICON_MAP[module.icon] ?? TrendingUpIcon;
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => navigateToModule(module.id)}
                className={cn(
                  "group relative flex flex-col gap-3 rounded-xl border bg-card p-5 text-left transition-all",
                  "hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                )}
              >
                {/* Top accent bar */}
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-amber-500/40 via-orange-400/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/15">
                    <Icon className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{module.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {module.skillIds.length} 个技能包
                    </p>
                  </div>
                </div>

                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {module.description}
                </p>

                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  {module.skillIds.slice(0, 3).map((skillId) => (
                    <span
                      key={skillId}
                      className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {skillId}
                    </span>
                  ))}
                  {module.skillIds.length > 3 && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      +{module.skillIds.length - 3}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Disclaimer footer */}
        <div className="mt-6 rounded-lg border border-dashed border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            ⚠️ <span className="font-medium">免责声明：</span>
            金融量化工作台提供的所有分析基于技能获取的公开数据与逻辑推演，不构成任何投资建议。
            市场存在不可预知的风险，投资决策请基于独立判断。
          </p>
        </div>
      </div>
    </div>
  );
}

function CredentialBadge({ label, ok }: { label: string; ok: boolean }) {
  const Icon = ok ? CheckCircle2Icon : XCircleIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
        ok
          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
          : "border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400",
      )}
      title={
        ok
          ? `${label} 凭证已配置`
          : `${label} 凭证未配置，相关数据获取技能将无法使用`
      }
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

