"use client";

import { ArrowLeftIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";
import { cn } from "@/lib/utils";

import { WorkspaceBrand } from "../workspace-brand";
import { WorkspaceUserInfo } from "../workspace-user-info";

import {
  SETTINGS_SECTION_COLORS,
  useSettingsLayout,
} from "./settings-layout-state";

export function SettingsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { t } = useI18n();
  const { activeSection, setActiveSection, sections } = useSettingsLayout();

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas" {...props}>
      <SidebarHeader className="desktop-titlebar-drag h-12 justify-center py-0 pr-2 pl-[72px]">
        <WorkspaceBrand />
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 pt-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t.workspace.backToWorkspace}>
                <Link href="/workspace/chats/new">
                  <ArrowLeftIcon />
                  <span>{t.workspace.backToWorkspace}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        <div className="px-2 pt-2">
          <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-sidebar-foreground/70">
            <SettingsIcon className="size-3.5" />
            <span>{t.settings.title}</span>
          </div>
          <SidebarMenu>
            {sections.map(({ id, label, icon: Icon }) => {
              const active = activeSection === id;
              const colors = SETTINGS_SECTION_COLORS[id];
              return (
                <SidebarMenuItem key={id}>
                  {active && (
                    <div
                      className={`absolute top-1 bottom-1 left-0 w-1 rounded-full bg-gradient-to-b ${colors.bar}`}
                    />
                  )}
                  <SidebarMenuButton
                    type="button"
                    isActive={active}
                    tooltip={label}
                    onClick={() => setActiveSection(id)}
                    className={cn(
                      "h-9 gap-3",
                      active ? "pl-3.5" : "text-sidebar-foreground/75",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md transition-colors",
                        active
                          ? `${colors.bg} ${colors.iconActive}`
                          : "text-sidebar-foreground/60",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <WorkspaceUserInfo />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
