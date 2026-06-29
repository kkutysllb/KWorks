"use client";

import {
  AnimatedSpan,
  Terminal,
  TypingAnimation,
} from "@/components/ui/terminal";

import { Section } from "../section";

export function SandboxSection({ className }: { className?: string }) {
  return (
    <Section
      className={className}
      title="可观察的长任务执行"
      subtitle={
        <p>
          QiongQi 把模型思考、工具调用、文件变更和用户中断统一成流式事件。
          任务还在跑，界面就能持续呈现真实状态。
        </p>
      }
    >
      <div className="mt-8 flex w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:gap-16">
        {/* Left: Terminal */}
        <div className="w-full flex-1">
          <Terminal className="h-[360px] w-full">
            <TypingAnimation>$ qiongqi serve --runtime node</TypingAnimation>
            <AnimatedSpan delay={800} className="text-zinc-400">
              QIONGQI_READY http://127.0.0.1:9193
            </AnimatedSpan>

            <TypingAnimation delay={1200}>
              $ start turn --thread current
            </TypingAnimation>
            <AnimatedSpan delay={2000} className="text-green-500">
              ✔ user_message recorded
            </AnimatedSpan>

            <TypingAnimation delay={2400}>
              $ stream events --mode values,messages
            </TypingAnimation>
            <AnimatedSpan delay={3200} className="text-blue-500">
              → assistant_reasoning folded
            </AnimatedSpan>

            <TypingAnimation delay={3600}>
              $ tool bash --sandbox workspace
            </TypingAnimation>
            <AnimatedSpan delay={4200} className="text-green-500">
              ✔ command approved
            </AnimatedSpan>
            <AnimatedSpan delay={4500} className="text-green-500">
              ✔ result attached to turn
            </AnimatedSpan>
            <AnimatedSpan delay={4800} className="text-green-500">
              ✔ title and state updated
            </AnimatedSpan>

            <TypingAnimation delay={5400}>
              $ interrupt run --preserve-state
            </TypingAnimation>
            <AnimatedSpan delay={6200} className="text-zinc-400">
              run stopped, thread remains resumable
            </AnimatedSpan>
          </Terminal>
        </div>

        {/* Right: Description */}
        <div className="w-full flex-1 space-y-6">
          <div className="space-y-4">
            <p className="text-sm font-medium tracking-wider text-purple-400 uppercase">
              Runtime Event Log
            </p>
            <h2 className="text-4xl font-bold tracking-tight lg:text-5xl">
              从黑盒执行变成可接管流程
            </h2>
          </div>

          <div className="space-y-4 text-lg text-zinc-400">
            <p>
              每个 turn 都由事件驱动：开始、推理、工具调用、工具结果、完成、
              失败或中断。前端不再展示中间件噪音，而是消费经过兼容层整理后的
              用户可见状态。
            </p>
            <p>
              对长任务来说，这意味着停止按钮、标签页切换、标题更新和历史恢复
              都围绕同一条事件链工作。
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
              流式消息
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
              可中断运行
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
              状态回放
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
              工具审计
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
              线程恢复
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}
