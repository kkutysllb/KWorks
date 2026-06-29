"use client";

import {
  ChevronsUpDown,
  PaletteIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";

type SettingsSection =
  | "account"
  | "appearance";

const MENU_ITEMS: {
  id: SettingsSection;
  icon: typeof UserIcon;
  color: string;
  labelKey: "account" | "appearance";
}[] = [
  { id: "account", icon: UserIcon, color: "text-sky-500", labelKey: "account" },
  { id: "appearance", icon: PaletteIcon, color: "text-violet-500", labelKey: "appearance" },
];

function NavMenuButtonContent({
  isSidebarOpen,
  t,
}: {
  isSidebarOpen: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return isSidebarOpen ? (
    <div className="flex w-full items-center gap-2 text-left text-sm">
      <span className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-slate-500 via-zinc-500 to-neutral-600 text-white">
        <SettingsIcon className="size-3" />
      </span>
      <span className="text-muted-foreground">{t.workspace.settingsAndMore}</span>
      <ChevronsUpDown className="text-muted-foreground ml-auto size-4" />
    </div>
  ) : (
    <div className="flex size-full items-center justify-center">
      <span className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-slate-500 via-zinc-500 to-neutral-600 text-white">
        <SettingsIcon className="size-3" />
      </span>
    </div>
  );
}

export function WorkspaceNavMenu() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { open: isSidebarOpen } = useSidebar();
  const { t } = useI18n();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <SidebarMenu className="w-full">
        <SidebarMenuItem>
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span className="block w-full">
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <NavMenuButtonContent isSidebarOpen={isSidebarOpen} t={t} />
                  </SidebarMenuButton>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                align="end"
                sideOffset={4}
              >
                {MENU_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => router.push(`/workspace/settings#${item.id}`)}
                    >
                      <Icon className={`size-4 ${item.color}`} />
                      {t.settings.sections[item.labelKey]}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <NavMenuButtonContent isSidebarOpen={isSidebarOpen} t={t} />
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
