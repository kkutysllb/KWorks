"use client";

import {
  Blocks,
  Brain,
  Clock,
  Code2,
  HardDrive,
  Layers,
} from "lucide-react";
import type { ReactNode } from "react";

import MagicBento, { type BentoCardProps } from "@/components/ui/magic-bento";
import { cn } from "@/lib/utils";

import { Section } from "../section";

const purple = "#a855f7";
const amber = "#f59e0b";
const blue = "#3b82f6";
const emerald = "#10b981";
const cyan = "#06b6d4";
const teal = "#14b8a6";

type CapabilityFeature = {
  accent: string;
  color: string;
  icon: ReactNode;
  label: string;
  title: string;
  summary: string;
  metric: string;
  metricLabel: string;
  flow: string[];
  tags: string[];
};

function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function cardDecoration(accent: string) {
  return (
    <div className="animated-decoration">
      <div
        className="card-decoration-orb card-decoration-orb--main"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${accent}88 0%, ${accent}22 40%, transparent 70%)`,
        }}
      />
      <div
        className="card-decoration-orb card-decoration-orb--secondary"
        style={{
          background: `radial-gradient(circle at 60% 60%, ${accent}66 0%, ${accent}18 50%, transparent 75%)`,
        }}
      />
      <div
        className="card-decoration-orb card-decoration-orb--tertiary"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accent}aa 0%, transparent 60%)`,
        }}
      />
      <div className="card-decoration-shimmer" />
    </div>
  );
}

function CapabilityCardContent({
  accent,
  flow,
  metric,
  metricLabel,
  summary,
  tags,
}: Pick<
  CapabilityFeature,
  "accent" | "flow" | "metric" | "metricLabel" | "summary" | "tags"
>) {
  return (
    <div className="capability-card">
      <p className="capability-card__summary">{summary}</p>
      <div className="capability-card__metric">
        <span style={{ color: accent }}>{metric}</span>
        <span>{metricLabel}</span>
      </div>
      <div className="capability-card__flow">
        {flow.map((item, index) => (
          <div key={item} className="capability-card__flow-item">
            <span className="capability-card__flow-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="capability-card__tags">
        {tags.map((tag) => (
          <span key={tag} className="capability-card__tag">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

const capabilityFeatures: CapabilityFeature[] = [
  {
    accent: purple,
    color: tint(purple, 0.07),
    icon: <Brain className="size-5" style={{ color: purple }} />,
    label: "Engine",
    title: "QiongQi 唯一内核",
    summary: "普通 Agent、Coding Agent 和技能执行都落到同一个内核协议里。",
    metric: "1 Core",
    metricLabel: "统一执行事实源",
    flow: ["任务意图进入内核", "模型与工具共享上下文", "结果回写线程"],
    tags: ["统一调度", "同源上下文", "少一层编排"],
  },
  {
    accent: amber,
    color: tint(amber, 0.07),
    icon: <Clock className="size-5" style={{ color: amber }} />,
    label: "Runs",
    title: "长任务可停止可恢复",
    summary: "每一次长任务都以事件链路推进，停止、恢复、失败都有明确位置。",
    metric: "Run Log",
    metricLabel: "事件链路",
    flow: ["启动 run", "流式事件推进", "中断后按状态恢复"],
    tags: ["事件链路", "可恢复状态机", "无需轮询猜测"],
  },
  {
    accent: blue,
    color: tint(blue, 0.07),
    icon: <Blocks className="size-5" style={{ color: blue }} />,
    label: "Tools",
    title: "工具调用可审计",
    summary: "Shell、文件、技能、沙箱和 MCP 调用都变成可检查的结构化记录。",
    metric: "Audit",
    metricLabel: "审计轨迹",
    flow: ["工具请求", "权限与沙箱边界", "结构化结果回写"],
    tags: ["审计轨迹", "MCP", "Sandbox", "Files"],
  },

  {
    accent: emerald,
    color: tint(emerald, 0.07),
    icon: <HardDrive className="size-5" style={{ color: emerald }} />,
    label: "State",
    title: "线程状态持久化",
    summary: "标题、消息、记忆、工具结果和运行历史围绕线程持续沉淀。",
    metric: "Thread",
    metricLabel: "可恢复状态机",
    flow: ["用户消息入线程", "运行状态同步", "历史与记忆沉淀"],
    tags: ["状态快照", "记忆", "运行历史"],
  },
  {
    accent: cyan,
    color: tint(cyan, 0.07),
    icon: <Layers className="size-5" style={{ color: cyan }} />,
    label: "Desktop",
    title: "桌面端原生集成",
    summary: "桌面壳负责启动和看护 Node 运行时，本地路径、文件和进程更直接。",
    metric: "Daemon",
    metricLabel: "桌面守护进程",
    flow: ["桌面启动 gateway", "内核常驻", "任务结果本地落盘"],
    tags: ["本地优先", "进程看护", "结果文件"],
  },
  {
    accent: teal,
    color: tint(teal, 0.07),
    icon: <Code2 className="size-5" style={{ color: teal }} />,
    label: "UI",
    title: "前端只看用户态",
    summary: "思考、工具和中间事件被整理成可读状态，聊天主线只保留用户需要看的结果。",
    metric: "Clean UI",
    metricLabel: "用户态视图",
    flow: ["内部事件折叠", "状态面板承接细节", "聊天主线保持干净"],
    tags: ["用户态视图", "折叠中间态", "可接管"],
  },
];

const features: BentoCardProps[] = capabilityFeatures.map((feature) => ({
  color: feature.color,
  decoration: cardDecoration(feature.accent),
  icon: feature.icon,
  label: feature.label,
  title: feature.title,
  description: (
    <CapabilityCardContent
      accent={feature.accent}
      flow={feature.flow}
      metric={feature.metric}
      metricLabel={feature.metricLabel}
      summary={feature.summary}
      tags={feature.tags}
    />
  ),
}));

export function WhatsNewSection({ className }: { className?: string }) {
  return (
    <Section
      className={cn("", className)}
      title="围绕新引擎重建的能力"
      subtitle="KWorks 不再把多个编排层拼在一起，而是让 QiongQi 负责执行、事件和状态闭环。"
    >
      <div className="flex w-full items-center justify-center">
        <MagicBento data={features} textAutoHide={false} />
      </div>
    </Section>
  );
}
