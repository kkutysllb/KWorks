import { useEffect, useRef, useState } from "react";

import type { Translations } from "@/core/i18n";
import { cn } from "@/lib/utils";

export type ToolCallStatus = "pending" | "running" | "completed" | "failed";

export interface BashApproval {
  approvalId: string;
  status: "pending" | "allowed" | "denied" | "expired";
  summary: string;
}

interface BashCommandCardProps {
  command: string;
  status: ToolCallStatus;
  /** Merged stdout+stderr. Undefined when not yet available. */
  output?: string;
  exitCode?: number | null;
  /** Pre-counted or truncation-provided total line count. */
  lineCount?: number;
  approval?: BashApproval;
  t: Translations;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
}

/**
 * Codex-style compact step (●) + ZCode-style terminal command card.
 *
 * Collapse rule (status-driven, but respects manual toggle after first paint):
 *   running / failed → force expand
 *   completed        → collapse on first completion, then honor user clicks
 */
export function BashCommandCard({
  command,
  status,
  output,
  exitCode,
  lineCount,
  approval,
  t,
  onApprove,
  onDeny,
}: BashCommandCardProps) {
  const denied = approval?.status === "denied";
  // Initialize expanded to match the initial status so a card that mounts
  // already running/failed doesn't flip false→true on the first effect (which
  // adds the output area in a second paint and visibly jumps the layout).
  const [expanded, setExpanded] = useState(
    status === "running" || status === "failed",
  );
  const prevStatus = useRef<ToolCallStatus>(status);

  // Auto-expand while running/failed; collapse on first completion.
  useEffect(() => {
    if (status === "running" || status === "failed") {
      setExpanded(true);
    } else if (
      status === "completed" &&
      prevStatus.current !== "completed"
    ) {
      setExpanded(false);
    }
    prevStatus.current = status;
  }, [status]);

  // While running, keep the output pinned to the bottom so the newest line is
  // visible — UNLESS the user has scrolled up (then respect their view).
  // Defer to an animation frame to avoid a synchronous forced reflow
  // (scrollHeight read) on every streaming chunk.
  const outputRef = useRef<HTMLPreElement>(null);
  const stuckToBottom = useRef(true);
  useEffect(() => {
    if (status !== "running" || !stuckToBottom.current) return;
    const raf = requestAnimationFrame(() => {
      const el = outputRef.current;
      if (el && stuckToBottom.current) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [output, status, expanded]);

  const hasOutput = typeof output === "string" && output.length > 0;
  const count = lineCount ?? (hasOutput ? output.split("\n").length : 0);
  const isRunning = status === "running";
  const isFailed = status === "failed" || denied;

  // header status text + accent color
  const statusLabel = denied
    ? t.toolCalls.commandDenied
    : isRunning
      ? t.toolCalls.commandRunning
      : isFailed
        ? t.toolCalls.commandFailed
        : t.toolCalls.commandCompleted;
  const accent = isRunning
    ? "border-amber-500/40"
    : isFailed
      ? "border-red-500/40"
      : "border-border";

  const toggle = () => setExpanded((e) => !e);
  const canToggle = hasOutput || isRunning;

  return (
    <div
      className={cn(
        "mt-1 overflow-hidden rounded-md border bg-muted/40 text-xs",
        accent,
      )}
    >
      {/* terminal title bar */}
      <div
        className={cn(
          "flex items-center gap-1.5 bg-muted px-2.5 py-1.5",
          canToggle ? "cursor-pointer" : "",
        )}
        onClick={canToggle ? toggle : undefined}
        role={canToggle ? "button" : undefined}
        aria-expanded={canToggle ? expanded : undefined}
      >
        <span className="size-2 rounded-full bg-red-500/80" />
        <span className="size-2 rounded-full bg-amber-500/80" />
        <span className="size-2 rounded-full bg-green-500/80" />
        <span className="ml-1.5 text-muted-foreground">bash</span>
        <span
          className={cn(
            "ml-auto font-medium",
            isRunning && "text-amber-500",
            isFailed && "text-red-500",
            !isRunning && !isFailed && "text-green-500",
          )}
        >
          {statusLabel}
          {isFailed && typeof exitCode === "number"
            ? ` · ${t.toolCalls.commandExitCode(exitCode)}`
            : ""}
        </span>
        {hasOutput && (
          <span className="ml-2 text-muted-foreground">
            {expanded ? "▾" : "▸"} {t.toolCalls.commandOutputLines(count)}
          </span>
        )}
        {!hasOutput && !isRunning && (
          <span className="ml-2 text-muted-foreground">
            {t.toolCalls.commandNoOutput}
          </span>
        )}
      </div>

      {/* command body — green `$` prompt + foreground command (terminal aesthetic). */}
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[12px] leading-relaxed">
        <span className="text-green-500">$ </span>
        <span className="text-foreground">{command}</span>
      </pre>

      {/* output (collapsed by default; auto-expand while running/failed).
          Each line is its own element so individual lines stay queryable.
          While running, a min-height stabilizes the box so the card doesn't
          visibly "breathe" as output grows line-by-line. */}
      {expanded && hasOutput && (
        <pre
          ref={outputRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stuckToBottom.current =
              el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
          }}
          className={cn(
            "max-h-80 overflow-auto border-t border-border bg-background/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground",
            // Reserve a stable height while running to prevent per-line height
            // growth from jittering the card region.
            isRunning && "min-h-40",
          )}
        >
          {output.split("\n").map((line, i, lines) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
              {isRunning && i === lines.length - 1 && (
                <span className="ml-0.5 inline-block w-2 animate-pulse">▌</span>
              )}
            </div>
          ))}
        </pre>
      )}

      {/* approval actions */}
      {approval?.status === "pending" && (
        <div className="flex gap-2 border-t border-border px-3 py-2">
          <button
            type="button"
            className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
            onClick={() => onApprove?.(approval.approvalId)}
          >
            {t.toolCalls.approveCommand}
          </button>
          <button
            type="button"
            className="rounded border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => onDeny?.(approval.approvalId)}
          >
            {t.toolCalls.denyCommand}
          </button>
        </div>
      )}
    </div>
  );
}
