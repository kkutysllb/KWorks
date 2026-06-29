"use client";

import {
  BriefcaseBusinessIcon,
  ClockIcon,
  NetworkIcon,
  PlusSquareIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function WorkspaceSpacesSection() {
  const pathname = usePathname();
  return (
    <SidebarGroup className="pt-1">
      <SidebarGroupLabel>功能区</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname === "/workspace/chats/new"}
            asChild
          >
            <Link className="text-muted-foreground" href="/workspace/chats/new">
              <PlusSquareIcon className="text-sky-500" />
              <span>新任务</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/skills")}
            asChild
          >
            <Link className="text-muted-foreground" href="/workspace/skills">
              <SparklesIcon className="text-amber-500" />
              <span>技能</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/mcp")}
            asChild
          >
            <Link className="text-muted-foreground" href="/workspace/mcp">
              <NetworkIcon className="text-cyan-500" />
              <span>MCP 工具</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/token-usage")}
            asChild
          >
            <Link className="text-muted-foreground" href="/workspace/token-usage">
              <BriefcaseBusinessIcon className="text-emerald-500" />
              <span>状态观测</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/crons")}
            asChild
          >
            <Link className="text-muted-foreground" href="/workspace/crons">
              <ClockIcon className="text-orange-500" />
              <span>自动化</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function WorkspaceTasksSection() {
  return (
    <SidebarGroup className="pt-1">
      <SidebarGroupLabel>项目 / 任务</SidebarGroupLabel>
      <div className="text-muted-foreground/75 px-2 py-1.5 text-xs leading-relaxed">
        按工作目录沉淀任务。最近任务会在下方展示，模型与运行时高级配置在系统设置中管理。
      </div>
    </SidebarGroup>
  );
}

export function WorkspaceNavChatList() {
  return null;
}
