"use client";

import {
  DownloadIcon,
  LoaderCircleIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/core/auth/AuthProvider";
import { isDesktop } from "@/core/config";
import {
  checkForUpdates,
  installUpdate,
  onUpdateReady,
} from "@/core/desktop/updater";
import { useI18n } from "@/core/i18n/hooks";

function getRoleLabel(
  role: string,
  t: ReturnType<typeof useI18n>["t"],
): string {
  return role === "admin"
    ? t.workspace.userInfo.admin
    : t.workspace.userInfo.user;
}

export function WorkspaceUserInfo() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // ── Update state ─────────────────────────────────────────────────
  const [updateReady, setUpdateReady] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  const doCheck = useCallback(async () => {
    const info = await checkForUpdates();
    if (info?.available) {
      setUpdateVersion(info.version ?? null);
    }
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;
    const timer = setTimeout(() => void doCheck(), 5000);
    return () => clearTimeout(timer);
  }, [doCheck]);

  useEffect(() => {
    if (!isDesktop()) return;
    return onUpdateReady((info) => {
      setUpdateVersion(info.version);
      setUpdateReady(true);
    });
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    const ok = await installUpdate();
    if (!ok) {
      setInstalling(false);
    }
  };

  if (!user) return null;

  const avatar = (
    <Avatar className="size-8 shrink-0 ring-2 ring-offset-1 ring-offset-background ring-violet-500/30">
      <AvatarFallback className="bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-white text-sm font-bold shadow-sm">
        <UserIcon className="size-4" />
      </AvatarFallback>
    </Avatar>
  );

  const settingsMenuItem = (
    <DropdownMenuItem onClick={() => router.push("/workspace/settings")}>
      <SettingsIcon className="size-4 text-slate-500" />
      {t.settings.title}
    </DropdownMenuItem>
  );

  const userInfoLabel = (
    <DropdownMenuLabel className="font-normal">
      <div className="flex items-center gap-1.5">
        <ShieldCheckIcon className={user.system_role === "admin" ? "size-3.5 text-amber-500" : "size-3.5 text-slate-400"} />
        <span className="text-muted-foreground text-xs">
          {getRoleLabel(user.system_role, t)}
        </span>
      </div>
    </DropdownMenuLabel>
  );

  const updateButton = (updateReady || installing) ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-emerald-400 transition-colors hover:bg-sidebar-accent hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {installing ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <DownloadIcon className="size-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {installing ? "正在重启…" : `新版本 v${updateVersion ?? ""} 已就绪，点击安装`}
      </TooltipContent>
    </Tooltip>
  ) : null;

  if (isCollapsed) {
    return (
      <div className="px-2 pt-2">
        <Separator className="mb-2" />
        <div className="flex items-center justify-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span className="inline-flex">
                <button type="button" className="outline-none">
                  {avatar}
                </button>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" sideOffset={8} className="min-w-52">
              {userInfoLabel}
              <DropdownMenuSeparator />
              {settingsMenuItem}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOutIcon className="size-4 text-rose-500" />
                {t.workspace.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {updateButton}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pt-2">
      <Separator className="mb-3" />
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className="block min-w-0 flex-1">
              <button type="button" className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                {avatar}
                <span className="text-muted-foreground truncate text-xs leading-tight">
                  {getRoleLabel(user.system_role, t)}
                </span>
              </button>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52">
            {userInfoLabel}
            <DropdownMenuSeparator />
            {settingsMenuItem}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOutIcon className="size-4 text-rose-500" />
              {t.workspace.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {updateButton}
      </div>
    </div>
  );
}
