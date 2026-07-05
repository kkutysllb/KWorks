"use client";

import { ClockIcon, SendIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Tooltip } from "../tooltip";

export interface PendingQueueEntry {
  id: string;
  text: string;
  createdAt: number;
}

/**
 * Shows messages buffered while a turn is streaming. Each entry can be
 * "steered" (injected into the running turn immediately) or removed. The
 * queue auto-sends the first entry when the current turn finishes.
 */
export function PendingQueueStrip({
  className,
  entries,
  onSteer,
  onRemove,
}: {
  className?: string;
  entries: PendingQueueEntry[];
  onSteer: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div
      className={cn(
        "border-border/70 bg-background/80 flex max-h-24 w-full flex-col gap-2 overflow-y-auto rounded-xl border px-3 py-2 shadow-sm backdrop-blur",
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <ClockIcon className="size-3.5 shrink-0 text-amber-500" />
        <span className="font-medium text-foreground">待发送</span>
        <span>{entries.length} 条</span>
        <span className="ml-1">任务完成后自动发送</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="bg-muted/45 flex max-w-full items-start gap-1.5 rounded-md border px-2 py-1.5"
          >
            <span className="text-muted-foreground shrink-0 text-xs font-medium">
              {index === 0 ? "下一个" : `#${index + 1}`}
            </span>
            <span
              className="min-w-0 flex-1 whitespace-pre-wrap break-words px-1 text-left text-xs"
              title={entry.text}
            >
              {entry.text.length > 120
                ? `${entry.text.slice(0, 120)}…`
                : entry.text}
            </span>
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip content="立即注入当前任务">
                <Button
                  aria-label="立即注入当前任务"
                  className="size-6"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => onSteer(entry.id)}
                >
                  <SendIcon className="size-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content="移除">
                <Button
                  aria-label="移除"
                  className="size-6"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => onRemove(entry.id)}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
