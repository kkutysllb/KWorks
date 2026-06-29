"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import SolarSystem from "@/components/ui/solar-system";
import { cn } from "@/lib/utils";

export function Hero({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center",
        className,
      )}
    >
      <div className="absolute inset-0 z-0">
        <SolarSystem starCount={300} particleCount={120} />
      </div>
      <div className="container-md relative z-10 mx-auto flex h-screen flex-col items-center justify-start pt-[28vh]">
        <div className="mb-4 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-1.5 text-sm font-medium tracking-[0.24em] text-cyan-200 uppercase">
          QiongQi Native Runtime
        </div>
        <h1 className="max-w-5xl text-center text-4xl font-bold leading-tight md:text-6xl">
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
            <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-cyan-400/30 via-purple-500/30 to-pink-500/30 blur-2xl opacity-0 transition-all duration-700 group-hover:opacity-100" />
            <Button
              className="relative h-12 px-10 text-lg font-semibold bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 hover:from-cyan-500 hover:via-purple-500 hover:to-pink-500 text-white shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-500 hover:scale-105 rounded-xl border-0"
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
