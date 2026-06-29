"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex size-full flex-col items-center justify-center",
        className,
      )}
    >
      <KineticKBackground />
      <div className="container-md relative z-10 mx-auto flex h-screen flex-col items-center justify-start pt-[28vh]">
        <div className="mb-4 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-1.5 text-sm font-medium tracking-[0.24em] text-cyan-200 uppercase">
          QiongQi Native Runtime
        </div>
        <h1 className="max-w-5xl text-center text-4xl leading-tight font-bold md:text-6xl">
          <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            KWorks
          </span>
          <span className="text-white"> 由 QiongQi 引擎驱动</span>
        </h1>
        <p className="mt-6 max-w-4xl text-center text-xl text-zinc-400 text-shadow-sm md:text-2xl">
          用纯 Node.js 的 QiongQi 作为唯一执行引擎，把线程、任务、工具调用、
          记忆和流式事件收束到同一个事实源。
          <br />
          面向长任务、代码执行和多工具协作，
          <br />
          让桌面端智能体运行更稳定、更透明、更容易接管。
        </p>
        <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-3 text-sm text-zinc-300 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            唯一执行引擎
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            线程事实源
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            流式事件总线
          </div>
        </div>
        <Link href="/workspace" className="group mt-14">
          <div className="relative inline-block">
            {/* Outer glow ring */}
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 opacity-75 blur-sm transition-all duration-500 group-hover:opacity-100 group-hover:blur-md" />
            {/* Inner glow on hover */}
            <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-cyan-400/30 via-purple-500/30 to-pink-500/30 opacity-0 blur-2xl transition-all duration-700 group-hover:opacity-100" />
            <Button
              className="relative h-12 rounded-xl border-0 bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 px-10 text-lg font-semibold text-white shadow-xl shadow-purple-500/25 transition-all duration-500 hover:scale-105 hover:from-cyan-500 hover:via-purple-500 hover:to-pink-500 hover:shadow-purple-500/40"
              size="lg"
            >
              <span className="text-md">进入工作台</span>
              <ChevronRightIcon className="size-5 transition-all duration-300 group-hover:translate-x-1" />
            </Button>
          </div>
        </Link>
      </div>
    </div>
  );
}

function KineticKBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#03050a]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08),rgba(9,12,24,0.52)_34%,rgba(3,5,10,0.98)_72%)]" />
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(70,105,160,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(70,105,160,0.09)_1px,transparent_1px)] [background-size:84px_84px] opacity-55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_22%,rgba(125,178,255,0.26)_0_2px,transparent_3px),radial-gradient(circle_at_72%_18%,rgba(255,255,255,0.2)_0_1px,transparent_2px),radial-gradient(circle_at_82%_68%,rgba(125,178,255,0.22)_0_2px,transparent_3px),radial-gradient(circle_at_24%_76%,rgba(255,255,255,0.16)_0_1px,transparent_2px)] bg-[length:220px_220px,310px_310px,270px_270px,190px_190px] opacity-70" />

      <div className="absolute top-1/2 left-1/2 aspect-square w-[min(76vw,48rem)] -translate-x-1/2 -translate-y-1/2">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            className="kworks-sonar-ring absolute top-1/2 left-1/2 size-full rounded-full border border-cyan-200/18"
            style={{
              animationDelay: `${index * -0.7}s`,
            }}
          />
        ))}

        <div className="absolute inset-0 rounded-full bg-cyan-300/6 blur-3xl" />
        <svg
          className="kworks-k-depth absolute top-1/2 left-1/2 w-[min(46vw,28rem)] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_46px_rgba(251,191,36,0.22)]"
          viewBox="0 0 512 512"
          role="img"
          aria-label="KWorks K"
        >
          <defs>
            <linearGradient
              id="heroKGold"
              x1="115"
              y1="140"
              x2="402"
              y2="396"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="22%" stopColor="#fde68a" />
              <stop offset="48%" stopColor="#fbbf24" />
              <stop offset="74%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <filter id="heroKGlow" x="-35%" y="-35%" width="170%" height="170%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="12"
                floodColor="#fbbf24"
                floodOpacity="0.26"
              />
            </filter>
          </defs>

          <circle cx="258" cy="278" r="178" fill="#fbbf24" opacity="0.045" />
          <g
            filter="url(#heroKGlow)"
            fill="none"
            stroke="url(#heroKGold)"
            strokeLinecap="round"
            strokeOpacity="0.72"
          >
            <line x1="156" y1="188" x2="156" y2="352" strokeWidth="84" />
            <path d="M 192 274 Q 286 220, 372 162" strokeWidth="66" />
            <path d="M 192 266 Q 286 320, 372 378" strokeWidth="66" />
          </g>
          <path
            d="M 140 168 Q 156 158, 172 168"
            fill="none"
            stroke="#fef3c7"
            strokeLinecap="round"
            strokeOpacity="0.36"
            strokeWidth="3"
          />
          <g className="opacity-35">
            <circle cx="212" cy="112" r="16" fill="#fde68a" />
            <circle cx="264" cy="88" r="12" fill="#fcd34d" />
            <circle cx="310" cy="114" r="9" fill="#fbbf24" />
          </g>
        </svg>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0_34%,rgba(3,5,10,0.4)_62%,rgba(0,0,0,0.82)_100%)]" />
    </div>
  );
}
