"use client";

import {
  AlertTriangleIcon,
  BriefcaseBusinessIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Code2Icon,
  Download,
  FileJson,
  FileText,
  HistoryIcon,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";
import {
  navigateWorkspaceInPlace,
  useWorkspacePathname,
} from "@/core/navigation/workspace-route";
import type { Project } from "@/core/projects";
import { useProjects } from "@/core/projects";
import { useWorkModes } from "@/core/skills/hooks";
import {
  exportThreadAsJSON,
  exportThreadAsMarkdown,
} from "@/core/threads/export";
import {
  useDeleteThread,
  useRenameThread,
  useThreads,
} from "@/core/threads/hooks";
import {
  qiongqiClient,
  threadRecordToAgentThread,
} from "@/core/threads/qiongqi-client";
import type { AgentThread } from "@/core/threads/types";
import { pathOfThread, titleOfThread } from "@/core/threads/utils";
import { isIMEComposing } from "@/lib/ime";
import { cn } from "@/lib/utils";

import {
  groupHistoryTasksByWorkMode,
  historyTaskWorkModeId,
  type HistoryTaskGroup,
  type HistoryTaskThread,
} from "./history-tasks";

function parseThreadIdFromPath(pathname: string | null): string {
  if (!pathname) return "new";
  const match = /\/chats\/([^/?#]+)/.exec(pathname);
  const raw = match?.[1];
  if (!raw) return "new";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function withCodingProjectRoutes(
  threads: AgentThread[],
  projects: Project[],
): Array<AgentThread & HistoryTaskThread> {
  if (projects.length === 0) return threads;
  const projectIdByPath = new Map(
    projects.map((project) => [normalizeWorkspacePath(project.path), project.id]),
  );
  return threads.map((thread) => {
    if (historyTaskWorkModeId(thread) !== "coding") return thread;
    const workspaceRoot = thread.context?.workspaceRoot;
    const projectId = workspaceRoot
      ? projectIdByPath.get(normalizeWorkspacePath(workspaceRoot))
      : undefined;
    if (!projectId) return thread;
    return {
      ...thread,
      context: {
        ...thread.context,
        projectId,
      },
    } as AgentThread & HistoryTaskThread;
  });
}

function normalizeWorkspacePath(path: string): string {
  return path.trim().replace(/\/+$/, "");
}

export function HistoryTaskList() {
  const { t } = useI18n();
  const router = useRouter();
  const routerPathname = usePathname();
  const pathname = useWorkspacePathname(routerPathname);
  // In the Electron desktop build, useParams() returns stale values from the
  // pre-rendered new.html RSC payload. Parse thread_id from the real URL
  // pathname instead.
  const threadIdFromPath = parseThreadIdFromPath(pathname);
  const { data: threads = [] } = useThreads();
  const { projects } = useProjects();
  const { workModes } = useWorkModes();
  const routableThreads = withCodingProjectRoutes(threads, projects);
  const { mutateAsync: deleteThread } = useDeleteThread();
  const { mutate: renameThread } = useRenameThread();

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<
    Record<string, boolean>
  >({});

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const deleteTargetTitle =
    routableThreads.find((t) => t.thread_id === deleteTarget)?.values?.title ??
    deleteTarget ??
    "";

  const navigateToWorkspacePath = useCallback(
    (path: string) => {
      if (navigateWorkspaceInPlace(path)) return;
      router.push(path);
    },
    [router],
  );

  const handleDelete = useCallback(
    (threadId: string) => {
      setDeleteTarget(threadId);
    },
    [],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteThread({ threadId: targetId });
      toast.success(t.historyTasks.deleteSuccess);
      if (targetId === threadIdFromPath) {
        const threadIndex = routableThreads.findIndex(
          (t) => t.thread_id === targetId,
        );
        let nextThreadPath = pathOfThread("new");
        if (threadIndex > -1) {
          if (routableThreads[threadIndex + 1]) {
            nextThreadPath = pathOfThread(routableThreads[threadIndex + 1]!);
          } else if (routableThreads[threadIndex - 1]) {
            nextThreadPath = pathOfThread(routableThreads[threadIndex - 1]!);
          }
        }
        navigateToWorkspacePath(nextThreadPath);
      }
    } catch {
      // Error toast already shown by useDeleteThread onError callback
    }
  }, [
    deleteTarget,
    deleteThread,
    navigateToWorkspacePath,
    routableThreads,
    threadIdFromPath,
    t,
  ]);

  const handleRenameClick = useCallback(
    (threadId: string, currentTitle: string) => {
      setRenameThreadId(threadId);
      setRenameValue(currentTitle);
      setRenameDialogOpen(true);
    },
    [],
  );

  const handleRenameSubmit = useCallback(() => {
    if (renameThreadId && renameValue.trim()) {
      renameThread({ threadId: renameThreadId, title: renameValue.trim() });
      setRenameDialogOpen(false);
      setRenameThreadId(null);
      setRenameValue("");
    }
  }, [renameThread, renameThreadId, renameValue]);

  const handleShare = useCallback(
    async (thread: AgentThread) => {
      // Always use Vercel URL for sharing so others can access
      const VERCEL_URL = "https://kkworks.com";
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      // On localhost: use Vercel URL; On production: use current origin
      const baseUrl = isLocalhost ? VERCEL_URL : window.location.origin;
      const shareUrl = `${baseUrl}${pathOfThread(thread)}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t.clipboard.linkCopied);
      } catch {
        toast.error(t.clipboard.failedToCopyToClipboard);
      }
    },
    [t],
  );

  const handleExport = useCallback(
    async (thread: AgentThread, format: "markdown" | "json") => {
      try {
        const record = await qiongqiClient.getThread(thread.thread_id);
        const agentThread = threadRecordToAgentThread(record);
        const messages = agentThread.values.messages ?? [];
        if (messages.length === 0) {
          toast.error(t.conversation.noMessages);
          return;
        }
        if (format === "markdown") {
          exportThreadAsMarkdown(thread, messages);
        } else {
          exportThreadAsJSON(thread, messages);
        }
        toast.success(t.common.exportSuccess);
      } catch {
        toast.error("Failed to export conversation");
      }
    },
    [t],
  );

  const handleToggleGroup = useCallback((groupId: string) => {
    setCollapsedGroupIds((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }, []);

  if (threads.length === 0) {
    return null;
  }
  const taskGroups = groupHistoryTasksByWorkMode(routableThreads, workModes);
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center gap-1.5">
          <HistoryIcon className="size-3.5" />
          {t.sidebar.historyTasks}
        </SidebarGroupLabel>
        <SidebarGroupContent className="group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0">
          <SidebarMenu>
            <div className="flex w-full flex-col gap-3">
              {taskGroups.map((group) => (
                <HistoryTaskGroupSection
                  key={group.id}
                  group={group}
                  isCollapsed={collapsedGroupIds[group.id] === true}
                  pathname={pathname}
                  onDelete={handleDelete}
                  onExport={handleExport}
                  onRename={handleRenameClick}
                  onShare={handleShare}
                  onToggle={() => handleToggleGroup(group.id)}
                  onNavigate={navigateToWorkspacePath}
                />
              ))}
            </div>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Delete confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="p-0 sm:max-w-md">
          <div className="h-1.5 w-full rounded-t-lg bg-gradient-to-r from-red-400 to-rose-400" />
          <DialogHeader className="px-6 pt-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                <AlertTriangleIcon className="h-4 w-4" />
              </span>
              {t.historyTasks.deleteTask}
            </DialogTitle>
            <DialogDescription className="pl-10">
              {t.historyTasks.deleteConfirm.replace(
                "{name}",
                deleteTargetTitle,
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-6 pb-5">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              className="shadow-sm"
            >
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t.common.rename}</DialogTitle>
            <DialogDescription className="sr-only">
              为当前项目或任务输入新的名称。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={t.common.rename}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isIMEComposing(e)) {
                  e.preventDefault();
                  handleRenameSubmit();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button onClick={handleRenameSubmit}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HistoryTaskGroupSection({
  group,
  isCollapsed,
  onDelete,
  onExport,
  onRename,
  onNavigate,
  onShare,
  onToggle,
  pathname,
}: {
  group: HistoryTaskGroup<AgentThread>;
  isCollapsed: boolean;
  pathname: string | null;
  onDelete: (threadId: string) => void;
  onExport: (thread: AgentThread, format: "markdown" | "json") => void;
  onRename: (threadId: string, currentTitle: string) => void;
  onNavigate: (path: string) => void;
  onShare: (thread: AgentThread) => void;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const GroupIcon = group.id === "coding" ? Code2Icon : BriefcaseBusinessIcon;
  const ToggleIcon = isCollapsed ? ChevronRightIcon : ChevronDownIcon;
  const contentId = `history-task-group-${group.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        onClick={onToggle}
        className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-[11px] font-medium transition-colors"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ToggleIcon className="size-3 shrink-0" />
          <GroupIcon
            className={
              group.id === "coding"
                ? "size-3.5 text-sky-500"
                : "size-3.5 text-emerald-500"
            }
          />
          <span className="truncate">{group.label}</span>
        </span>
        <span className="rounded border px-1 font-mono text-[10px]">
          {group.count}
        </span>
      </button>
      {!isCollapsed && (
        <div id={contentId} className="flex w-full flex-col gap-1">
          {group.threads.map((thread) => {
            const isActive = pathOfThread(thread) === pathname;
            const threadPath = pathOfThread(thread);
            return (
              <SidebarMenuItem
                key={thread.thread_id}
                className="group/side-menu-item"
              >
                <button
                  type="button"
                  data-active={isActive}
                  data-sidebar="menu-button"
                  data-size="default"
                  data-slot="sidebar-menu-button"
                  className={cn(
                    "peer/menu-button flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 pr-8 text-left text-sm whitespace-nowrap outline-hidden ring-sidebar-ring transition-[width,height,padding]",
                    "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground focus-visible:ring-2",
                    "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
                    "group-hover/side-menu-item:overflow-hidden",
                  )}
                  title={titleOfThread(thread)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onNavigate(threadPath);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {titleOfThread(thread)}
                    </span>
                    <span className="text-muted-foreground/70 block truncate text-[10px]">
                      {historyTaskWorkModeId(thread)} ·{" "}
                      {formatTaskTime(thread.updated_at)}
                    </span>
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <span className="inline-flex">
                      <SidebarMenuAction
                        showOnHover
                        className="bg-background/50 hover:bg-background"
                      >
                        <MoreHorizontal />
                        <span className="sr-only">{t.common.more}</span>
                      </SidebarMenuAction>
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-48 rounded-lg"
                    side={"right"}
                    align={"start"}
                  >
                    <DropdownMenuItem
                      onSelect={() =>
                        onRename(thread.thread_id, titleOfThread(thread))
                      }
                    >
                      <Pencil className="text-blue-500" />
                      <span>{t.common.rename}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onShare(thread)}>
                      <Share2 className="text-emerald-500" />
                      <span>{t.common.share}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Download className="text-violet-500" />
                        <span>{t.common.export}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          onSelect={() => onExport(thread, "markdown")}
                        >
                          <FileText className="text-cyan-500" />
                          <span>{t.common.exportAsMarkdown}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onExport(thread, "json")}
                        >
                          <FileJson className="text-amber-500" />
                          <span>{t.common.exportAsJSON}</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onDelete(thread.thread_id)}>
                      <Trash2 className="text-rose-500" />
                      <span>{t.common.delete}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTaskTime(value: string | null | undefined): string {
  if (!value) return "未更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未更新";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
