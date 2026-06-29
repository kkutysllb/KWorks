"use client";

import {
  Blocks,
  Brain,
  Clock,
  Code2,
  HardDrive,
  Layers,
} from "lucide-react";

import MagicBento, { type BentoCardProps } from "@/components/ui/magic-bento";
import { cn } from "@/lib/utils";

import { Section } from "../section";

// ── 每张卡片的主题色 ──────────────────────────────────────────────
const purple = "#a855f7";
const amber = "#f59e0b";
const blue = "#3b82f6";
const emerald = "#10b981";
const cyan = "#06b6d4";
const teal = "#14b8a6";

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

const features: BentoCardProps[] = [
  {
    color: tint(purple, 0.07),
    icon: <Brain className="size-5" style={{ color: purple }} />,
    decoration: cardDecoration(purple),
    label: "Engine",
    title: "QiongQi 唯一内核",
    description: "普通 Agent 与 Coding Agent 共用同一个执行事实源",
  },
  {
    color: tint(amber, 0.07),
    icon: <Clock className="size-5" style={{ color: amber }} />,
    decoration: cardDecoration(amber),
    label: "Runs",
    title: "长任务可停止可恢复",
    description:
      "运行、中断、完成、失败都进入事件链，界面不靠轮询猜状态",
  },
  {
    color: tint(blue, 0.07),
    icon: <Blocks className="size-5" style={{ color: blue }} />,
    decoration: cardDecoration(blue),
    label: "Tools",
    title: "工具调用可审计",
    description:
      "Shell、文件、技能、沙箱与 MCP 能力都以结构化事件回写",
  },

  {
    color: tint(emerald, 0.07),
    icon: <HardDrive className="size-5" style={{ color: emerald }} />,
    decoration: cardDecoration(emerald),
    label: "State",
    title: "线程状态持久化",
    description: "标题、消息、记忆和运行历史都围绕线程沉淀",
  },
  {
    color: tint(cyan, 0.07),
    icon: <Layers className="size-5" style={{ color: cyan }} />,
    decoration: cardDecoration(cyan),
    label: "Desktop",
    title: "桌面端原生集成",
    description: "Node 运行时随桌面端启动，减少跨进程和跨语言摩擦",
  },
  {
    color: tint(teal, 0.07),
    icon: <Code2 className="size-5" style={{ color: teal }} />,
    decoration: cardDecoration(teal),
    label: "UI",
    title: "前端只看用户态",
    description: "思考、工具和中间事件被折叠整理，聊天主线保持干净",
  },
];

export function WhatsNewSection({ className }: { className?: string }) {
  return (
    <Section
      className={cn("", className)}
      title="围绕新引擎重建的能力"
      subtitle="KWorks 不再把多个编排层拼在一起，而是让 QiongQi 负责执行、事件和状态闭环。"
    >
      <div className="flex w-full items-center justify-center">
        <MagicBento data={features} />
      </div>
    </Section>
  );
}
