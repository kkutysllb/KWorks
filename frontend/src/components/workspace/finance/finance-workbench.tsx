"use client";

import {
  ArrowLeftRightIcon,
  Building2Icon,
  CandlestickChartIcon,
  ChevronLeftIcon,
  FilterIcon,
  FlaskConicalIcon,
  LayersIcon,
  LineChartIcon,
  type LucideIcon,
  SigmaIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ArtifactsProvider } from "@/components/workspace/artifacts";
import { TodoList } from "@/components/workspace/todo-list";
import { navigateWorkspaceInPlace } from "@/core/navigation/workspace-route";
import { getFinanceModule, type FinanceModuleIcon } from "@/core/finance/modules";
import type { Todo } from "@/core/todos";
import { cn } from "@/lib/utils";

import { FinanceAgentPanel } from "./finance-agent-panel";

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

interface FinanceWorkbenchProps {
  moduleId: string;
}

export function FinanceWorkbench({ moduleId }: FinanceWorkbenchProps) {
  const router = useRouter();
  const currentModule = getFinanceModule(moduleId);
  const [agentTodos, setAgentTodos] = useState<Todo[]>([]);

  // In Electron (app:// protocol), router.push triggers will-navigate which
  // reloads the page. Use history.pushState via navigateWorkspaceInPlace.
  const navigateToPath = (path: string) => {
    if (!navigateWorkspaceInPlace(path)) {
      router.push(path);
    }
  };

  if (!currentModule) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 text-center">
        <div className="bg-amber-500/10 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-amber-500/20">
          <TrendingUpIcon className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <p className="text-lg font-semibold">未找到该分析模块</p>
          <p className="mt-1 text-sm text-muted-foreground">
            模块 &quot;{moduleId}&quot; 不存在，请从模块列表中选择。
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateToPath("/workspace/finance")}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
        >
          返回模块列表
        </button>
      </div>
    );
  }

  const CurrentIcon = ICON_MAP[currentModule.icon] ?? TrendingUpIcon;
  const showFloatingTodos = agentTodos.length > 0;

  return (
    <ArtifactsProvider>
      <div className="relative flex size-full min-h-0 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToPath("/workspace/finance")}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              <ChevronLeftIcon className="size-4" />
              金融量化
            </button>
            <span className="text-muted-foreground/30">/</span>
            <div className="flex items-center gap-2">
              <div className="bg-amber-500/10 flex size-8 items-center justify-center rounded-lg ring-1 ring-amber-500/15">
                <CurrentIcon className="h-4 w-4 text-amber-500" />
              </div>
              <h1 className="text-base font-semibold">{currentModule.name}</h1>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            {currentModule.skillIds.map((skillId) => (
              <span
                key={skillId}
                className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {skillId}
              </span>
            ))}
          </div>
        </header>

        {/* Agent panel — full width, no sidebar */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <FinanceAgentPanel
            module={currentModule}
            onTodosChange={setAgentTodos}
            avoidRightFloatingPanels={showFloatingTodos}
          />
        </div>

        {/* Floating TodoList panel — top-right, mirrors coding workbench */}
        {showFloatingTodos && (
          <div className="pointer-events-none absolute top-16 right-3 z-40 w-80">
            <TodoList
              className={cn("pointer-events-auto max-w-full")}
              todos={agentTodos}
              variant="floating"
            />
          </div>
        )}
      </div>
    </ArtifactsProvider>
  );
}
