"use client";

import {
  LogOutIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

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
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/core/auth/AuthProvider";
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

  if (isCollapsed) {
    return (
      <div className="px-2 pt-2">
        <Separator className="mb-2" />
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span className="inline-flex">
                <button type="button" className="outline-none">
                  {avatar}
                </button>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="min-w-52">
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
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pt-2">
      <Separator className="mb-3" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className="block w-full">
            <button type="button" className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              {avatar}
              <span className="text-muted-foreground truncate text-xs leading-tight">
                {getRoleLabel(user.system_role, t)}
              </span>
            </button>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="min-w-52">
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
    </div>
  );
}
