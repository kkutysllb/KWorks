"use client";

import {
  BriefcaseBusinessIcon,
  ClockIcon,
  Code2Icon,
  FolderOpenIcon,
  NetworkIcon,
  PlusSquareIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useProjects } from "@/core/projects";
import { useThreads } from "@/core/threads/hooks";
import { pathOfThread, titleOfThread } from "@/core/threads/utils";
import { cn } from "@/lib/utils";

import {
  buildProjectTaskSummary,
  type ProjectTaskBucket,
  type ProjectTaskThread,
} from "./project-tasks";

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
  const pathname = usePathname();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { data: threads = [], isLoading: threadsLoading } = useThreads();
  const currentWorkspaceRoot = currentWorkspaceRootFromPath(pathname, threads);
  const summary = buildProjectTaskSummary({
    projects,
    threads,
    currentWorkspaceRoot,
    maxThreadsPerProject: 2,
  });
  const isLoading = projectsLoading || threadsLoading;
  const visibleBuckets = summary.buckets.slice(0, 3);

  return (
    <SidebarGroup className="pt-1">
      <SidebarGroupLabel className="flex items-center justify-between gap-2">
        <span>项目 / 任务</span>
        <Link
          href="/workspace/coding"
          className="text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5 text-[10px] transition-colors"
        >
          全部
        </Link>
      </SidebarGroupLabel>
      <SidebarGroupContent className="space-y-2 px-2">
        {isLoading ? (
          <ProjectTasksLoading />
        ) : visibleBuckets.length > 0 ? (
          visibleBuckets.map((bucket) => (
            <ProjectTaskBucketCard key={bucket.project.id} bucket={bucket} />
          ))
        ) : (
          <ProjectTasksEmpty />
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function WorkspaceNavChatList() {
  return null;
}

function ProjectTaskBucketCard({ bucket }: { bucket: ProjectTaskBucket }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-sidebar-accent/20 p-2.5",
        bucket.isCurrent
          ? "border-sky-500/35 bg-sky-500/10"
          : "border-sidebar-border/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/workspace/coding/${encodeURIComponent(bucket.project.id)}`}
          className="min-w-0 flex-1"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <FolderOpenIcon className="size-3.5 shrink-0 text-emerald-500" />
            <span className="truncate">{bucket.project.name}</span>
          </span>
          <span className="text-muted-foreground/70 mt-0.5 block truncate text-[10px]">
            {bucket.project.path}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {bucket.isCurrent && (
            <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400">
              当前
            </span>
          )}
          {bucket.runningCount > 0 && (
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
              {bucket.runningCount} 运行
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Link
          href={`/workspace/coding/${encodeURIComponent(bucket.project.id)}`}
          className="hover:bg-sidebar-accent rounded-md border border-sidebar-border/70 px-2 py-1 text-center text-[10px] transition-colors"
        >
          打开项目
        </Link>
        <Link
          href={`/workspace/coding/${encodeURIComponent(bucket.project.id)}`}
          className="hover:bg-sidebar-accent rounded-md border border-sidebar-border/70 px-2 py-1 text-center text-[10px] transition-colors"
        >
          项目新任务
        </Link>
      </div>

      {bucket.threads.length > 0 ? (
        <div className="mt-2 space-y-1">
          {bucket.threads.map((thread) => (
            <ProjectTaskThreadRow key={thread.thread_id} thread={thread} />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground/70 mt-2 rounded-md border border-dashed border-sidebar-border/70 px-2 py-1.5 text-[10px]">
          暂无项目任务
        </div>
      )}
    </div>
  );
}

function ProjectTaskThreadRow({ thread }: { thread: ProjectTaskThread }) {
  return (
    <Link
      href={pathOfThread(thread)}
      className="hover:bg-sidebar-accent flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors"
      title={titleOfThread(thread)}
    >
      <span className="min-w-0">
        <span className="block truncate text-[11px]">{titleOfThread(thread)}</span>
        <span className="text-muted-foreground/70 block truncate text-[10px]">
          {formatTaskTime(thread.updated_at)}
        </span>
      </span>
      {thread.status === "busy" ? (
        <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
          运行中
        </span>
      ) : (
        <Code2Icon className="text-muted-foreground/60 size-3 shrink-0" />
      )}
    </Link>
  );
}

function ProjectTasksEmpty() {
  return (
    <div className="rounded-lg border border-dashed border-sidebar-border/70 px-2.5 py-3">
      <div className="text-xs font-medium">暂无项目任务</div>
      <p className="text-muted-foreground/75 mt-1 text-[11px] leading-relaxed">
        绑定工作目录后，相关任务会按项目沉淀在这里。
      </p>
      <Link
        href="/workspace/coding"
        className="text-sky-400 hover:text-sky-300 mt-2 inline-flex text-[11px]"
      >
        打开项目列表
      </Link>
    </div>
  );
}

function ProjectTasksLoading() {
  return (
    <div className="space-y-2">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="h-20 animate-pulse rounded-lg border border-sidebar-border/60 bg-sidebar-accent/20"
        />
      ))}
    </div>
  );
}

function currentWorkspaceRootFromPath(
  pathname: string | null,
  threads: ProjectTaskThread[],
): string | null {
  if (!pathname) return null;
  const match = /\/workspace\/chats\/([^/?#]+)/.exec(pathname);
  const threadId = match?.[1];
  if (!threadId || threadId === "new") return null;
  const decoded = decodeURIComponent(threadId);
  return threads.find((thread) => thread.thread_id === decoded)?.context
    ?.workspaceRoot ?? null;
}

function formatTaskTime(value: string | null | undefined): string {
  if (!value) return "未更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未更新";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
