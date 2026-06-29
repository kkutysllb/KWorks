"use client";

import {
  BotIcon,
  BrainIcon,
  CpuIcon,
  GlobeIcon,
  MessageSquareIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";


import { useI18n } from "@/core/i18n/hooks";
import { cn } from "@/lib/utils";

import { AuroraText } from "../ui/aurora-text";

let waved = false;

// 装饰图标数据
const DECORATIVE_ICONS = [
  { icon: BotIcon, color: "text-violet-400" },
  { icon: CpuIcon, color: "text-emerald-400" },
  { icon: BrainIcon, color: "text-cyan-400" },
  { icon: GlobeIcon, color: "text-blue-400" },
  { icon: TerminalIcon, color: "text-amber-400" },
  { icon: MessageSquareIcon, color: "text-rose-400" },
  { icon: WrenchIcon, color: "text-orange-400" },
];

// 底部特性标签
const FEATURE_BADGES = [
  { label: "QiongQi Engine", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { label: "Node.js Runtime", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { label: "用户隔离", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { label: "任务观测", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { label: "ROI 统计", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
];

export function Welcome({
  className,
  collaborationPolicy,
}: {
  className?: string;
  collaborationPolicy?: "single" | "auto";
}) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const isCollaborative = useMemo(
    () => collaborationPolicy === "auto",
    [collaborationPolicy],
  );
  const colors = useMemo(() => {
    if (isCollaborative) {
      return ["#efefbb", "#e9c665", "#e3a812"];
    }
    return ["#22d3ee", "#a855f7", "#ec4899"];
  }, [isCollaborative]);
  useEffect(() => {
    waved = true;
  }, []);
  return (
    <div
      className={cn(
        "relative mx-auto flex w-full flex-col items-center justify-center gap-3 px-8 py-6 text-center",
        className,
      )}
    >
      {/* Decorative icon row */}
      <div className="relative flex items-center gap-1.5 opacity-50">
        {DECORATIVE_ICONS.map(({ icon: Icon, color }, i) => (
          <Icon
            key={i}
            className={cn("size-3.5 transition-all duration-500", color)}
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>

      {/* Main title */}
      <div className="relative">
        <div className="relative text-xl font-bold">
        {searchParams.get("mode") === "skill" ? (
          <span className="bg-linear-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            ✨ {t.welcome.createYourOwnSkill} ✨
          </span>
        ) : searchParams.get("mode") === "cron" ? (
          <span className="bg-linear-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
            ⏰ {t.welcome.createCronJob} ⏰
          </span>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className={cn("inline-block text-3xl", !waved ? "animate-bounce" : "")}>
              {isCollaborative ? "🤝" : "👋"}
            </div>
            <AuroraText colors={isCollaborative ? ["#efefbb", "#e9c665", "#e3a812"] : ["#a78bfa", "#6366f1", "#3b82f6"]}>
              {t.welcome.greeting}
            </AuroraText>
          </div>
        )}
      </div>
      </div>

      {searchParams.get("mode") === "skill" ? (
        <div className="relative text-muted-foreground text-sm leading-relaxed max-w-lg">
          {t.welcome.createYourOwnSkillDescription.includes("\n") ? (
            <pre className="font-sans whitespace-pre">
              {t.welcome.createYourOwnSkillDescription}
            </pre>
          ) : (
            <p>{t.welcome.createYourOwnSkillDescription}</p>
          )}
        </div>
      ) : searchParams.get("mode") === "cron" ? (
        <div className="relative text-muted-foreground text-sm leading-relaxed max-w-lg">
          <p>{t.welcome.createCronJobDescription}</p>
        </div>
      ) : (
        <div className="relative text-muted-foreground text-sm leading-relaxed max-w-lg">
          {t.welcome.description.includes("\n") ? (
            <pre className="font-sans whitespace-pre">
              {t.welcome.description}
            </pre>
          ) : (
            <p>{t.welcome.description}</p>
          )}
        </div>
      )}

      {/* Feature badges */}
      {searchParams.get("mode") !== "skill" && searchParams.get("mode") !== "cron" && (
        <div className="relative flex flex-wrap items-center justify-center gap-2 pt-1">
          {FEATURE_BADGES.map(({ label, color }) => (
            <span
              key={label}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                color,
              )}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
