"use client";

import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { AccountSettingsPage } from "@/components/workspace/settings/account-settings-page";
import { AppearanceSettingsPage } from "@/components/workspace/settings/appearance-settings-page";
import {
  ConfigSettingsPage,
  type ConfigWriteStatus,
} from "@/components/workspace/settings/config-settings-page";
import { WorkModeSettingsPage } from "@/components/workspace/settings/work-mode-settings-page";
import { useI18n } from "@/core/i18n/hooks";
import { cn } from "@/lib/utils";

import {
  QIONGQI_SECTION_PAGE,
  SETTINGS_SECTION_COLORS,
  isQiongqiSection,
  useSettingsLayout,
  type SettingsSection,
} from "./settings-layout-state";

export type { SettingsSection } from "./settings-layout-state";

type SettingsPageShellProps = {
  mode?: "page" | "dialog";
};

export function SettingsPageShell({
  mode = "page",
}: SettingsPageShellProps) {
  const { t } = useI18n();
  const { activeSection, setActiveSection, sections } = useSettingsLayout();
  const [configWriteStatus, setConfigWriteStatus] =
    useState<ConfigWriteStatus>({ kind: "idle" });
  const isPage = mode === "page";

  useEffect(() => {
    setConfigWriteStatus({ kind: "idle" });
  }, [activeSection]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        isPage ? "h-full bg-background" : "h-full",
      )}
    >
      {!isPage && (
        <div className="min-w-0 shrink-0 px-6 pt-4 pb-4">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3 text-lg font-semibold tracking-tight">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-sm">
                    <SettingsIcon className="size-5" />
                  </span>
                  {t.settings.title}
                </div>
                <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
                  {t.settings.description}
                </p>
              </div>
            </div>
            <ConfigWriteStatus status={configWriteStatus} />
          </div>
        </div>
      )}

      {isPage ? (
        <div className="min-h-0 min-w-0 flex-1 px-8 py-8">
          <SettingsSectionContent
            activeSection={activeSection}
            onWriteStatusChange={setConfigWriteStatus}
            className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border"
          />
        </div>
      ) : (
        <div className="grid min-h-0 min-w-0 flex-1 gap-4 px-6 pb-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="bg-sidebar min-h-0 overflow-y-auto rounded-lg border p-2">
            <ul className="space-y-1 pr-1">
              {sections.map(({ id, label, icon: Icon }) => {
                const active = activeSection === id;
                const colors = SETTINGS_SECTION_COLORS[id];
                return (
                  <li key={id} className="relative">
                    {active && (
                      <div
                        className={`absolute top-1 bottom-1 left-0 w-1 rounded-full bg-gradient-to-b ${colors.bar}`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveSection(id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-muted/80 text-foreground pl-4"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-md transition-colors",
                          active
                            ? `${colors.bg} ${colors.iconActive}`
                            : "text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="truncate">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <SettingsSectionContent
            activeSection={activeSection}
            onWriteStatusChange={setConfigWriteStatus}
            className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border"
          />
        </div>
      )}
    </div>
  );
}

function SettingsSectionContent({
  activeSection,
  className,
  onWriteStatusChange,
}: {
  activeSection: SettingsSection;
  className?: string;
  onWriteStatusChange: (status: ConfigWriteStatus) => void;
}) {
  return (
    <ScrollArea className={className}>
      <div className="flex min-h-full min-w-0 flex-1 flex-col p-6">
        {activeSection === "account" && <AccountSettingsPage />}
        {activeSection === "appearance" && <AppearanceSettingsPage />}
        {activeSection === "work-modes" && <WorkModeSettingsPage />}
        {isQiongqiSection(activeSection) && (
          <ConfigSettingsPage
            initialPage={QIONGQI_SECTION_PAGE[activeSection]}
            showNav={false}
            onWriteStatusChange={onWriteStatusChange}
          />
        )}
      </div>
    </ScrollArea>
  );
}

function ConfigWriteStatus({ status }: { status: ConfigWriteStatus }) {
  if (status.kind === "idle") {
    return <div className="h-7 w-[180px] shrink-0" aria-hidden="true" />;
  }
  const className =
    status.kind === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300"
      : status.kind === "success"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
        : status.kind === "dirty"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300";
  return (
    <div
      title={status.message}
      className={cn(
        "mt-1 flex h-7 w-[180px] shrink-0 items-center justify-center rounded-md border px-2 text-xs font-medium",
        className,
      )}
    >
      <span className="truncate">{status.message}</span>
    </div>
  );
}
