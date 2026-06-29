"use client";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";

import { HistoryTaskList } from "./history-task-list";
import { WorkspaceBrand } from "./workspace-brand";
import {
  WorkspaceNavChatList,
  WorkspaceSpacesSection,
  WorkspaceTasksSection,
} from "./workspace-nav-chat-list";
import { WorkspaceUserInfo } from "./workspace-user-info";

export function WorkspaceSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <>
      <Sidebar variant="sidebar" collapsible="offcanvas" {...props}>
        <SidebarHeader className="desktop-titlebar-drag h-12 justify-center py-0 pr-2 pl-[72px]">
          <WorkspaceBrand />
        </SidebarHeader>
        <SidebarContent>
          <WorkspaceSpacesSection />
          <WorkspaceTasksSection />
          <WorkspaceNavChatList />
          <HistoryTaskList />
        </SidebarContent>
        <SidebarFooter>
          <WorkspaceUserInfo />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  );
}
