import {
  ChevronDownIcon,
  ChevronUpIcon,
  ListTodoIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Todo } from "@/core/todos";
import { cn } from "@/lib/utils";

type TodoListVariant = "inline" | "floating";

function normalizeTodos(todos: TodoListProps["todos"]): Todo[] {
  if (Array.isArray(todos)) return todos;
  if (
    todos &&
    typeof todos === "object" &&
    Array.isArray((todos as { items?: unknown }).items)
  ) {
    return (todos as { items: Todo[] }).items;
  }
  return [];
}

function getTodoSignature(todos: Todo[]): string {
  return todos
    .map((todo, index) =>
      [todo.id ?? index, todo.content ?? "", todo.status ?? "pending"].join(
        ":",
      ),
    )
    .join("|");
}

type TodoListProps = {
  className?: string;
  todos: Todo[] | { items?: Todo[] } | null | undefined;
  collapsed?: boolean;
  hidden?: boolean;
  onToggle?: () => void;
  onFloatingVisibilityChange?: (visible: boolean) => void;
  variant?: TodoListVariant;
};

export function TodoList({
  className,
  todos,
  collapsed: controlledCollapsed,
  hidden = false,
  onToggle,
  onFloatingVisibilityChange,
  variant = "inline",
}: TodoListProps) {
  const safeTodos = useMemo(() => normalizeTodos(todos), [todos]);
  const todoSignature = useMemo(() => getTodoSignature(safeTodos), [safeTodos]);
  const isFloating = variant === "floating";
  const [internalCollapsed, setInternalCollapsed] = useState(!isFloating);
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(
    null,
  );
  const previousSignatureRef = useRef(todoSignature);
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;
  const completedCount = safeTodos.filter(
    (todo) => todo.status === "completed",
  ).length;
  const isDismissed =
    isFloating &&
    dismissedSignature !== null &&
    dismissedSignature === todoSignature;
  const shouldHide = hidden || safeTodos.length === 0 || isDismissed;
  const floatingOccupiesSpace = isFloating && !shouldHide && !collapsed;

  useEffect(() => {
    if (!isFloating) return;
    if (safeTodos.length === 0) {
      setDismissedSignature(null);
      return;
    }
    if (todoSignature !== previousSignatureRef.current) {
      setDismissedSignature(null);
      if (!isControlled) setInternalCollapsed(false);
    }
    previousSignatureRef.current = todoSignature;
  }, [isControlled, isFloating, safeTodos.length, todoSignature]);

  useEffect(() => {
    if (!isFloating) return;
    onFloatingVisibilityChange?.(floatingOccupiesSpace);
  }, [floatingOccupiesSpace, isFloating, onFloatingVisibilityChange]);

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const handleDismiss = () => {
    setDismissedSignature(todoSignature);
  };

  if (isFloating && shouldHide) return null;

  return (
    <div
      className={cn(
        "flex h-fit flex-col overflow-hidden border transition-all duration-200 ease-out",
        isFloating
          ? "todo-floating-panel bg-background/82 supports-[backdrop-filter]:bg-background/72 w-[min(21rem,calc(100vw-2rem))] rounded-xl border-white/10 shadow-[0_18px_55px_rgb(0_0_0/0.28)] backdrop-blur-xl"
          : "bg-background w-full origin-bottom translate-y-4 rounded-t-xl border-b-0 backdrop-blur-sm",
        !isFloating && shouldHide
          ? "pointer-events-none translate-y-8 opacity-0"
          : "",
        className,
      )}
    >
      <header
        className={cn(
          "flex min-h-8 shrink-0 items-center justify-between gap-3 text-sm transition-all duration-300 ease-out",
          isFloating
            ? "min-h-11 border-b border-white/10 bg-white/[0.03] px-3.5"
            : "bg-accent cursor-pointer px-3",
        )}
        onClick={isFloating ? undefined : handleToggle}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-2",
            isFloating ? "text-foreground/88" : "text-muted-foreground",
          )}
        >
          <ListTodoIcon
            className={cn(
              "size-4 shrink-0",
              isFloating ? "text-muted-foreground" : "",
            )}
          />
          <div className="min-w-0 truncate font-medium">
            {isFloating ? "任务步骤" : "To-dos"}
          </div>
          {isFloating && (
            <div className="text-muted-foreground/80 shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] leading-none tabular-nums">
              {completedCount}/{safeTodos.length}
            </div>
          )}
        </div>
        {isFloating ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              aria-label={collapsed ? "展开任务步骤" : "收起任务步骤"}
              className="text-muted-foreground hover:text-foreground size-7 rounded-md"
              size="icon"
              type="button"
              variant="ghost"
              onClick={handleToggle}
            >
              {collapsed ? (
                <ChevronDownIcon className="size-4" />
              ) : (
                <ChevronUpIcon className="size-4" />
              )}
            </Button>
            <Button
              aria-label="关闭任务步骤"
              className="text-muted-foreground hover:text-foreground size-7 rounded-md"
              size="icon"
              type="button"
              variant="ghost"
              onClick={handleDismiss}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        ) : (
          <div>
            <ChevronUpIcon
              className={cn(
                "text-muted-foreground size-4 transition-transform duration-300 ease-out",
                collapsed ? "" : "rotate-180",
              )}
            />
          </div>
        )}
      </header>
      {!collapsed && (
        <main
          className={cn(
            "flex grow transition-all duration-300 ease-out",
            isFloating
              ? "bg-background/35 max-h-72 px-2.5 py-2.5"
              : "bg-accent h-28 px-2 pb-4",
          )}
        >
          <ol
            className={cn(
              "todo-floating-list w-full",
              isFloating
                ? "space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                : "bg-background mt-0 rounded-t-xl",
            )}
          >
            {safeTodos.map((todo, i) => {
              const status = todo.status ?? "pending";
              return (
                <li
                  key={todo.id ?? `${i}-${todo.content ?? ""}`}
                  className={cn(
                    "group flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    isFloating
                      ? "text-muted-foreground/90 hover:bg-white/[0.05]"
                      : "hover:bg-muted flex-col gap-1",
                  )}
                  data-status={status}
                >
                  <span
                    className={cn(
                      "relative mt-0.5 size-2 shrink-0 rounded-full border",
                      status === "completed"
                        ? "border-emerald-400/30 bg-emerald-400/35"
                        : status === "in_progress"
                          ? "border-sky-400/70 bg-sky-400 shadow-[0_0_12px_rgb(56_189_248/0.45)]"
                          : "border-muted-foreground/35 bg-muted-foreground/10",
                    )}
                  >
                    {status === "in_progress" && (
                      <span className="absolute inset-0 rounded-full bg-sky-400/70 opacity-60 blur-[3px]" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px] leading-5",
                      status === "completed"
                        ? "text-muted-foreground/45 line-through"
                        : status === "in_progress"
                          ? "text-foreground/90"
                          : "text-muted-foreground/85",
                    )}
                  >
                    {todo.content}
                  </span>
                  {isFloating && status === "in_progress" && (
                    <span className="shrink-0 text-[11px] text-sky-300/90">
                      进行中
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </main>
      )}
    </div>
  );
}
