import { cn } from "@/lib/utils";

import { Section } from "../section";

export function SkillsSection({ className }: { className?: string }) {
  const capabilities = [
    {
      label: "Thread",
      title: "线程就是事实源",
      description:
        "标题、消息、工具结果、任务状态都回写到 QiongQi 线程，不再依赖多套状态镜像互相猜测。",
    },
    {
      label: "Turn",
      title: "每轮执行可追踪",
      description:
        "用户输入、模型输出、工具调用和中断恢复都被记录为可重放事件，长任务也能清楚知道执行到哪里。",
    },
    {
      label: "Runtime",
      title: "Node.js 原生运行",
      description:
        "桌面端直接启动 QiongQi Node 运行时，减少 Python/LangGraph 进程边界和跨语言状态同步成本。",
    },
  ];

  return (
    <Section
      className={cn("min-h-[calc(100vh-64px)] w-full bg-white/2 px-6", className)}
      title="QiongQi 执行内核"
      subtitle={
        <div>
          KWorks 现在以 QiongQi 作为唯一执行引擎。
          <br />
          线程、运行、事件和状态在同一个内核中闭环。
        </div>
      }
    >
      <div className="mx-auto mt-12 grid w-full max-w-6xl gap-4 md:grid-cols-3">
        {capabilities.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-white/10 bg-zinc-950/70 p-6 shadow-2xl shadow-cyan-950/20"
          >
            <div className="mb-8 text-xs font-semibold tracking-[0.3em] text-cyan-300 uppercase">
              {item.label}
            </div>
            <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
