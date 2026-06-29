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

import {
  QueueItem,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
} from "../ai-elements/queue";

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
  variant?: TodoListVariant;
};

export function TodoList({
  className,
  todos,
  collapsed: controlledCollapsed,
  hidden = false,
  onToggle,
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
        "dark:bg-background flex h-fit flex-col overflow-hidden border bg-white backdrop-blur-sm transition-all duration-200 ease-out",
        isFloating
          ? "w-[min(22rem,calc(100vw-2rem))] rounded-lg shadow-lg"
          : "w-full origin-bottom translate-y-4 rounded-t-xl border-b-0",
        !isFloating && shouldHide
          ? "pointer-events-none translate-y-8 opacity-0"
          : "",
        className,
      )}
    >
      <header
        className={cn(
          "bg-accent flex min-h-8 shrink-0 items-center justify-between gap-3 px-3 text-sm transition-all duration-300 ease-out",
          isFloating ? "min-h-10 border-b" : "cursor-pointer",
        )}
        onClick={isFloating ? undefined : handleToggle}
      >
        <div className="text-muted-foreground flex min-w-0 items-center gap-2">
          <ListTodoIcon className="size-4 shrink-0" />
          <div className="min-w-0 truncate font-medium">
            {isFloating ? "任务步骤" : "To-dos"}
          </div>
          {isFloating && (
            <div className="text-muted-foreground/70 shrink-0 text-xs tabular-nums">
              {completedCount}/{safeTodos.length}
            </div>
          )}
        </div>
        {isFloating ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              aria-label={collapsed ? "展开任务步骤" : "收起任务步骤"}
              className="size-7"
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
              className="size-7"
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
            "bg-accent flex grow px-2 transition-all duration-300 ease-out",
            isFloating ? "max-h-64 py-2" : "h-28 pb-4",
          )}
        >
          <QueueList
            className={cn(
              "bg-background mt-0 w-full",
              isFloating ? "rounded-md" : "rounded-t-xl",
            )}
          >
            {safeTodos.map((todo, i) => {
              const status = todo.status ?? "pending";
              return (
                <QueueItem
                  key={todo.id ?? `${i}-${todo.content ?? ""}`}
                  data-status={status}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <QueueItemIndicator
                      className={
                        status === "in_progress" ? "bg-primary/70" : ""
                      }
                      completed={status === "completed"}
                    />
                    <QueueItemContent
                      className={
                        status === "in_progress" ? "text-primary/70" : ""
                      }
                      completed={status === "completed"}
                    >
                      {todo.content}
                    </QueueItemContent>
                  </div>
                </QueueItem>
              );
            })}
          </QueueList>
        </main>
      )}
    </div>
  );
}
