import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Reuse the status type defined in BashCommandCard (Task 6) so there is a
// single source of truth for the tool-call lifecycle states.
export type { ToolCallStatus } from "./bash-command-card";
import type { ToolCallStatus } from "./bash-command-card";

interface ToolStepProps {
  status: ToolCallStatus;
  label: ReactNode;
  children?: ReactNode;
  /** Extra classes for the outer row (e.g. "cursor-pointer"). */
  className?: string;
  /** Optional click handler on the whole row (e.g. open a file). */
  onClick?: () => void;
}

/**
 * Codex-style compact step: a status-colored dot + label + optional children
 * (command card / file badge). Replaces the vertical-rail ChainOfThoughtStep
 * for tool calls — flatter, denser, status-aware.
 */
export function ToolStep({
  status,
  label,
  children,
  className,
  onClick,
}: ToolStepProps) {
  const dotClass =
    status === "running"
      ? "bg-amber-500 animate-pulse"
      : status === "failed"
        ? "bg-red-500"
        : status === "pending"
          ? "bg-muted-foreground/50"
          : "bg-primary";
  return (
    <div className={cn("flex gap-2 text-sm", className)} onClick={onClick}>
      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dotClass)} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <span className="font-medium">{label}</span>
        {children}
      </div>
    </div>
  );
}
