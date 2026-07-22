"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";
import { cn } from "@/lib/utils";

const HEADER_SLOT_IDS = {
  title: "workspace-header-title-slot",
  actions: "workspace-header-actions-slot",
} as const;

export function WorkspaceHeader({ className }: { className?: string }) {
  const { t } = useI18n();
  const { state } = useSidebar();
  return (
    <div
      className={cn(
        "desktop-titlebar-drag bg-background/95 flex h-12 shrink-0 items-start gap-2 border-b px-3 pt-1.5",
        state === "collapsed" && "pl-[72px]",
        className,
      )}
    >
      <div className="desktop-no-drag flex h-8 shrink-0 items-center gap-1.5">
        <SidebarTrigger
          data-testid="workspace-sidebar-trigger"
          className="shrink-0"
          aria-label={t.shortcuts.toggleSidebar}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-8 opacity-55"
          aria-label="后退"
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 opacity-35"
          aria-label="前进"
          disabled
        >
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>

      <div
        id={HEADER_SLOT_IDS.title}
        className="flex h-8 min-w-0 flex-1 items-center overflow-hidden px-2"
      />
      <div
        id={HEADER_SLOT_IDS.actions}
        className="desktop-no-drag flex h-8 shrink-0 items-center gap-1.5"
      />
    </div>
  );
}

export function WorkspaceHeaderPortal({
  slot,
  children,
}: {
  slot: keyof typeof HEADER_SLOT_IDS;
  children: React.ReactNode;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById(HEADER_SLOT_IDS[slot]));
  }, [slot]);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}
