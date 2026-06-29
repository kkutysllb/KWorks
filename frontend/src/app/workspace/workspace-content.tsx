import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

import { QueryClientProvider } from "@/components/query-client-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CommandPalette } from "@/components/workspace/command-palette";
import { SettingsLayoutProvider } from "@/components/workspace/settings/settings-layout-state";
import { SettingsSidebar } from "@/components/workspace/settings/settings-sidebar";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";

// Desktop static export: no cookies() access
export function WorkspaceContent({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isSettingsRoute = pathname === "/workspace/settings";

  return (
    <QueryClientProvider>
      {isSettingsRoute ? (
        <SidebarProvider className="h-screen" defaultOpen={true}>
          <SettingsLayoutProvider syncHash>
            <SettingsSidebar />
            <SidebarInset className="min-w-0">
              {children}
            </SidebarInset>
          </SettingsLayoutProvider>
        </SidebarProvider>
      ) : (
        <SidebarProvider className="h-screen" defaultOpen={true}>
          <WorkspaceSidebar />
          <SidebarInset className="min-w-0">
            <WorkspaceHeader />
            {children}
          </SidebarInset>
        </SidebarProvider>
      )}
      <CommandPalette />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
