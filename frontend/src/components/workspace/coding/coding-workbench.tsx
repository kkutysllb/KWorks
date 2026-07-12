"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  CopyIcon,
  CloudIcon,
  GithubIcon,
  FileTextIcon,
  GitBranchIcon,
  GitCompareIcon,
  GitCommitHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PlusIcon,
  XIcon,
  ActivityIcon,
  InfoIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  SendIcon,
  TerminalIcon,
  MonitorCogIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArtifactsProvider } from "@/components/workspace/artifacts";
import { TodoList } from "@/components/workspace/todo-list";
import {
  copyProjectTerminalPath,
  onEmbeddedTerminalData,
  onEmbeddedTerminalExit,
  openProjectTerminal,
  resizeEmbeddedTerminal,
  startEmbeddedTerminal,
  stopEmbeddedTerminal,
  writeEmbeddedTerminal,
} from "@/core/desktop";
import { useWorkspaceSearchParams } from "@/core/navigation/workspace-route";
import {
  ProjectFetchError,
  useAcceptStageSuggestion,
  useCodingSession,
  useCodingSkills,
  useDeliveryStages,
  useDismissStageSuggestion,
  useLatestCodingReview,
  useProjectEnvironment,
  useProjectGitCommit,
  useProjectGitPush,
  useProjectStage,
  useSetProjectStage,
  useProject,
  useWorktrees,
} from "@/core/projects";
import type {
  CodingSkill,
  DeliveryStage,
  ProjectStageState,
  StageHistoryEntry,
  StageSuggestion,
} from "@/core/projects";
import { codingThreadStorageKey } from "@/core/projects/coding-thread-routes";
import type { Todo } from "@/core/todos";
import { cn } from "@/lib/utils";

import { AgentPanel } from "./agent-panel";
import { CodeViewer } from "./code-viewer";
import { CodingDiffPanel } from "./coding-diff-panel";
import { CodingErrorBoundary } from "./coding-error-boundary";
import { CodingTaskChangesPanel } from "./coding-task-changes-panel";
import { FileExplorer } from "./file-explorer";
import { ReviewPanel } from "./review-panel";

interface CodingWorkbenchProps {
  projectId: string;
}

type WorkbenchFocusTarget = "code" | "task-changes" | "diff" | "review";
type AgentInspectorTab = "agent" | "workflow";
type WorkbenchFocusHandler = (
  filePath: string,
  target?: WorkbenchFocusTarget,
  taskId?: string,
  line?: number | null,
) => void;

type EmbeddedTerminalTab = {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  promptLabel: string;
  running: boolean;
};

const LEFT_PANEL_DEFAULT_WIDTH = 320;
const LEFT_PANEL_MIN_WIDTH = 240;
const LEFT_PANEL_MAX_WIDTH = 520;
const RIGHT_PANEL_DEFAULT_WIDTH = 640;
const RIGHT_PANEL_MIN_WIDTH = 420;
const RIGHT_PANEL_MAX_WIDTH = 1120;

export function CodingWorkbench({ projectId }: CodingWorkbenchProps) {
  const router = useRouter();
  const routerSearchParams = useSearchParams();
  const searchParams = useWorkspaceSearchParams(routerSearchParams);
  const { project, isLoading, error } = useProject(projectId);
  const { worktrees } = useWorktrees(projectId);
  const { environment } = useProjectEnvironment(projectId);
  const commitMutation = useProjectGitCommit(projectId);
  const pushMutation = useProjectGitPush(projectId);

  // If the project genuinely does not exist (HTTP 404 — typically because it
  // was deleted from another tab/session), bounce the user back to the list.
  // We deliberately only react to 404 and NOT to transient network/5xx errors,
  // so a flaky gateway doesn't kick users out of an otherwise valid project.
  useEffect(() => {
    if (
      !isLoading &&
      project === null &&
      error instanceof ProjectFetchError &&
      error.status === 404
    ) {
      toast.error("项目不存在或已被删除，已返回项目列表");
      router.replace("/workspace/coding");
    }
  }, [isLoading, project, error, router]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [focusedLine, setFocusedLine] = useState<number | null>(null);
  // Persist the agent thread ID per-project so switching workspace tabs and
  // coming back can restore the correct thread. This mirrors the logic in
  // AgentPanelInner — both components read/write the same localStorage key so
  // the Results/Diff panels and the Agent chat panel stay in sync after a tab
  // switch without either having to re-derive the thread ID.
  const threadIdStorageKey = codingThreadStorageKey(projectId);
  const [agentThreadId, setAgentThreadId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return window.localStorage.getItem(threadIdStorageKey) ?? undefined;
  });
  useEffect(() => {
    const routeThreadId = searchParams.get("thread");
    if (routeThreadId) {
      setAgentThreadId(routeThreadId);
      return;
    }
    if (searchParams.get("new") === "1") {
      setAgentThreadId(undefined);
    }
  }, [searchParams, threadIdStorageKey]);
  useEffect(() => {
    if (agentThreadId) {
      window.localStorage.setItem(threadIdStorageKey, agentThreadId);
    } else {
      window.localStorage.removeItem(threadIdStorageKey);
    }
  }, [agentThreadId, threadIdStorageKey]);
  const codingThreadId = agentThreadId ?? "";

  const [activeCodeTab, setActiveCodeTab] = useState<
    "code" | "changes" | "review"
  >("code");
  const [workbenchView, setWorkbenchView] = useState<
    "code" | "changes" | "review"
  >("code");
  const [activeInspectorTab, setActiveInspectorTab] =
    useState<AgentInspectorTab>("agent");
  const [isCommitDialogOpen, setCommitDialogOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  // Collapse state for the left file explorer and the right workbench panel.
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(
    LEFT_PANEL_DEFAULT_WIDTH,
  );
  const [rightPanelWidth, setRightPanelWidth] = useState(
    RIGHT_PANEL_DEFAULT_WIDTH,
  );
  const [environmentCardCollapsed, setEnvironmentCardCollapsed] =
    useState(false);
  const [agentTodos, setAgentTodos] = useState<Todo[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTabs, setTerminalTabs] = useState<EmbeddedTerminalTab[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const terminalWritersRef = useRef(new Map<string, (data: string) => void>());
  const [terminalHeight, setTerminalHeight] = useState(
    typeof window !== "undefined"
      ? Math.max(220, Math.round(window.innerHeight * 0.3))
      : 280,
  );

  useEffect(() => {
    const unsubscribeData = onEmbeddedTerminalData((event) => {
      terminalWritersRef.current.get(event.sessionId)?.(event.data);
    });
    const unsubscribeExit = onEmbeddedTerminalExit((event) => {
      terminalWritersRef.current.get(event.sessionId)?.(
        `\r\n[terminal exited: ${event.signal ?? event.code ?? "closed"}]\r\n`,
      );
      setTerminalTabs((tabs) =>
        tabs.map((tab) =>
          tab.id === event.sessionId ? { ...tab, running: false } : tab,
        ),
      );
    });
    return () => {
      unsubscribeData();
      unsubscribeExit();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex size-full items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold">项目未找到</p>
        <p className="text-muted-foreground text-sm">
          项目 ID &quot;{projectId}&quot; 不存在或已被删除。
        </p>
        <Link
          href="/workspace/coding"
          className="text-sm text-emerald-500 hover:underline"
        >
          ← 返回项目列表
        </Link>
      </div>
    );
  }

  const toggleLeft = () => {
    setLeftCollapsed((value) => !value);
  };

  const openWorkbenchPane = () => {
    setRightCollapsed(false);
  };

  const closeWorkbenchPane = () => {
    setRightCollapsed(true);
  };

  const showFileExplorer = !leftCollapsed;
  const showWorkbenchPane = !rightCollapsed;
  const showEnvironmentCard = !showWorkbenchPane && !environmentCardCollapsed;
  const showFloatingPanels =
    !showWorkbenchPane && (showEnvironmentCard || agentTodos.length > 0);

  const startPanelResize = (
    side: "left" | "right",
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? leftPanelWidth : rightPanelWidth;
    const minWidth =
      side === "left" ? LEFT_PANEL_MIN_WIDTH : RIGHT_PANEL_MIN_WIDTH;
    const maxWidth =
      side === "left" ? LEFT_PANEL_MAX_WIDTH : RIGHT_PANEL_MAX_WIDTH;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth =
        side === "left" ? startWidth + delta : startWidth - delta;
      const clampedWidth = Math.min(maxWidth, Math.max(minWidth, nextWidth));
      if (side === "left") {
        setLeftPanelWidth(clampedWidth);
      } else {
        setRightPanelWidth(clampedWidth);
      }
    };

    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });
  };

  const startTerminalResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = terminalHeight;
    const minHeight = 160;
    const maxHeight = Math.max(minHeight, Math.round(window.innerHeight * 0.8));

    const handlePointerMove = (moveEvent: PointerEvent) => {
      // Dragging the handle up grows the terminal: delta is negative when
      // moving toward the top of the viewport.
      const delta = startY - moveEvent.clientY;
      const nextHeight = Math.min(
        maxHeight,
        Math.max(minHeight, startHeight + delta),
      );
      setTerminalHeight(nextHeight);
    };

    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });
  };

  const focusWorkbenchFile = (
    filePath: string,
    target: WorkbenchFocusTarget = "code",
    taskId?: string,
    line?: number | null,
  ) => {
    setSelectedFile(normalizeProjectFilePath(filePath, project.path));
    setFocusedLine(line ?? null);
    // Both "task-changes" and "diff" collapse into the unified "changes" view.
    const resolvedView =
      target === "task-changes" || target === "diff" ? "changes" : target;
    setActiveCodeTab(resolvedView);
    setWorkbenchView(resolvedView);
    openWorkbenchPane();
    if (taskId) {
      setSelectedTaskId(taskId);
    }
  };

  const handleSelectExplorerFile = (filePath: string) => {
    focusWorkbenchFile(filePath, "code");
  };

  const handleOpenTerminal = async () => {
    const result = await openProjectTerminal(project.path);
    if (result === "opened") {
      setTerminalOpen(true);
      const session = await startEmbeddedTerminal(project.path);
      if (!session) {
        toast.error("无法创建项目终端", {
          description: project.path,
        });
        return;
      }
      const nextTab: EmbeddedTerminalTab = {
        id: session.sessionId,
        title: session.projectName,
        cwd: session.cwd,
        shell: session.shell,
        promptLabel: session.promptLabel,
        running: true,
      };
      setTerminalTabs((tabs) => [...tabs, nextTab]);
      setActiveTerminalId(session.sessionId);
      return;
    }
    if (result === "copied") {
      toast.info("Web 端无法直接打开本机终端，已复制项目路径", {
        description: project.path,
      });
      return;
    }
    toast.error("无法打开本机终端", {
      description: project.path || "项目路径不可用",
    });
  };

  const handleCloseTerminalTab = async (sessionId: string) => {
    terminalWritersRef.current.delete(sessionId);
    await stopEmbeddedTerminal(sessionId);
    setTerminalTabs((tabs) => {
      const nextTabs = tabs.filter((tab) => tab.id !== sessionId);
      if (nextTabs.length === 0) {
        setTerminalOpen(false);
        setActiveTerminalId(null);
      } else if (activeTerminalId === sessionId) {
        setActiveTerminalId(nextTabs[nextTabs.length - 1]?.id ?? null);
      }
      return nextTabs;
    });
  };

  const handleCloseTerminalPanel = async () => {
    const sessions = terminalTabs.map((tab) => tab.id);
    setTerminalOpen(false);
    setTerminalTabs([]);
    setActiveTerminalId(null);
    await Promise.all(
      sessions.map((sessionId) => stopEmbeddedTerminal(sessionId)),
    );
  };

  const handleCopyTerminalPath = async () => {
    const result = await copyProjectTerminalPath(project.path);
    if (result === "copied") {
      toast.success("已复制项目路径");
    } else {
      toast.error("复制项目路径失败");
    }
  };

  const handleToggleFileExplorer = () => {
    toggleLeft();
  };

  const handleToggleWorkbenchPane = () => {
    if (showWorkbenchPane) {
      closeWorkbenchPane();
      return;
    }
    openWorkbenchPane();
  };

  const handleSelectWorkbenchTab = (
    tab: "code" | "changes" | "review",
  ) => {
    setActiveCodeTab(tab);
    setWorkbenchView(tab);
    openWorkbenchPane();
  };

  const handleCommit = async () => {
    const message = commitMessage.trim();
    if (!message) {
      toast.error("请输入提交说明");
      return;
    }
    try {
      const result = await commitMutation.mutateAsync(message);
      toast.success("提交已创建", {
        description: result.summary,
      });
      setCommitDialogOpen(false);
      setCommitMessage("");
    } catch (commitError) {
      toast.error("提交失败", {
        description:
          commitError instanceof Error ? commitError.message : "请稍后重试",
      });
    }
  };

  const handlePush = async () => {
    try {
      const result = await pushMutation.mutateAsync();
      toast.success("分支已推送", {
        description: result.summary,
      });
    } catch (pushError) {
      toast.error("推送失败", {
        description:
          pushError instanceof Error ? pushError.message : "请稍后重试",
      });
    }
  };

  const gitBranch =
    environment?.branch ??
    worktrees.find((worktree) => worktree.branch)?.branch ??
    (project.is_git_repo ? "main" : "未连接");

  return (
    <ArtifactsProvider>
      <div className="flex size-full min-h-0 flex-col">
        {/* Header bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/workspace/coding"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              项目
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="truncate font-semibold">{project.name}</span>
            {project.is_git_repo && (
              <div className="bg-muted text-muted-foreground flex items-center gap-1 rounded-md px-2 py-0.5 text-xs">
                <GitBranchIcon className="h-3 w-3" />
                {worktrees.length > 0
                  ? `${worktrees.length} worktree${worktrees.length > 1 ? "s" : ""}`
                  : "main"}
              </div>
            )}
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <span className="text-muted-foreground hidden max-w-[18ch] truncate font-mono text-xs xl:inline 2xl:max-w-[28ch]">
              {project.path}
            </span>
            <div
              className="bg-muted text-muted-foreground inline-flex h-7 w-fit max-w-full shrink-0 items-center justify-center rounded-md p-0.5"
              role="tablist"
              aria-label="代码区视图"
              data-testid="coding-workbench-toolbar"
            >
              <WorkbenchToolbarButton
                active={activeCodeTab === "code"}
                icon={<FileTextIcon className="h-3 w-3" />}
                label="代码"
                onClick={() => handleSelectWorkbenchTab("code")}
              />
              <WorkbenchToolbarButton
                active={activeCodeTab === "changes"}
                icon={<GitCompareIcon className="h-3 w-3" />}
                label="变更"
                shortLabel="变更"
                onClick={() => handleSelectWorkbenchTab("changes")}
              />
              <WorkbenchToolbarButton
                active={activeCodeTab === "review"}
                icon={<ClipboardCheckIcon className="h-3 w-3" />}
                label="Code Review"
                shortLabel="Review"
                onClick={() => handleSelectWorkbenchTab("review")}
              />
            </div>
            <div
              className="bg-muted text-muted-foreground inline-flex h-7 w-fit shrink-0 items-center justify-center rounded-md p-0.5"
              role="tablist"
              aria-label="Agent 检查器视图"
              data-testid="agent-inspector-toolbar"
            >
              <AgentInspectorToolbarButton
                active={activeInspectorTab === "agent"}
                icon={<MessageSquareIcon className="h-3.5 w-3.5" />}
                label="对话"
                onClick={() => setActiveInspectorTab("agent")}
              />
              <AgentInspectorToolbarButton
                active={activeInspectorTab === "workflow"}
                icon={<GitCompareIcon className="h-3.5 w-3.5" />}
                label="流程"
                onClick={() => setActiveInspectorTab("workflow")}
              />
            </div>
            <Button
              aria-label="切换环境信息面板"
              aria-pressed={showEnvironmentCard}
              className="size-8 shrink-0"
              size="icon-sm"
              title={showEnvironmentCard ? "折叠环境信息" : "展开环境信息"}
              type="button"
              variant="ghost"
              onClick={() => setEnvironmentCardCollapsed((value) => !value)}
            >
              <MonitorCogIcon className="h-4 w-4" />
            </Button>
            <Button
              aria-label="新建项目终端"
              className="size-8 shrink-0"
              size="icon-sm"
              title="新建项目终端"
              type="button"
              variant="ghost"
              onClick={() => void handleOpenTerminal()}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Three-panel resizable layout */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mt-0 flex min-h-0 flex-1 overflow-hidden">
            <div className="relative flex size-full min-w-0 overflow-hidden">
              {showFloatingPanels && (
                <CodingFloatingPanelStack rightRailVisible={!showWorkbenchPane}>
                  {showEnvironmentCard && (
                    <EnvironmentInfoFloatingCard
                      branch={gitBranch}
                      githubCli={environment?.github_cli ?? null}
                      sourceLabel={environment?.source.label ?? "仅本地"}
                      sourceRemote={environment?.source.remote ?? null}
                      head={environment?.head ?? null}
                      ahead={environment?.ahead ?? 0}
                      behind={environment?.behind ?? 0}
                      commitPending={commitMutation.isPending}
                      pushPending={pushMutation.isPending}
                      commitDisabled={
                        !environment?.is_git_repo ||
                        (environment?.changed_files ?? 0) === 0
                      }
                      pushDisabled={!environment?.is_git_repo}
                      onCommit={() => setCommitDialogOpen(true)}
                      onPush={() => void handlePush()}
                      path={project.path}
                    />
                  )}
                  <CodingErrorBoundary
                    className="pointer-events-auto min-h-28 rounded-xl border"
                    label="任务步骤"
                    resetKey={`${codingThreadId}:${agentTodos.length}`}
                  >
                    <TodoList
                      className="pointer-events-auto max-w-full"
                      todos={agentTodos}
                      variant="floating"
                    />
                  </CodingErrorBoundary>
                </CodingFloatingPanelStack>
              )}
              {showFileExplorer ? (
                <>
                  <aside
                    className="shrink-0 overflow-hidden border-r"
                    style={{ width: leftPanelWidth }}
                  >
                    <FileExplorer
                      headerAction={
                        <PanelToggleButton
                          ariaLabel="折叠文件浏览器"
                          title="折叠文件浏览器"
                          onClick={handleToggleFileExplorer}
                        >
                          <PanelLeftCloseIcon className="h-4 w-4" />
                        </PanelToggleButton>
                      }
                      projectId={projectId}
                      selectedFile={selectedFile}
                      onSelectFile={handleSelectExplorerFile}
                    />
                  </aside>
                  <PanelResizeHandle
                    ariaLabel="调整文件浏览器宽度"
                    onPointerDown={(event) => startPanelResize("left", event)}
                  />
                </>
              ) : (
                <CollapsedSidePanelRail
                  ariaLabel="展开文件浏览器"
                  side="left"
                  title="展开文件浏览器"
                  onClick={handleToggleFileExplorer}
                >
                  <PanelLeftOpenIcon className="h-4 w-4" />
                </CollapsedSidePanelRail>
              )}
              {/* Middle: QiongQi engine */}
              <section className="relative min-w-0 flex-1 overflow-hidden">
                <div
                  className={cn(
                    "flex h-full min-h-0 min-w-0 flex-col overflow-hidden",
                  )}
                >
                  <CodingErrorBoundary
                    label="消息区域"
                    resetKey={codingThreadId}
                  >
                    <AgentInspector
                      avoidRightFloatingPanels={showFloatingPanels}
                      onFocusFile={focusWorkbenchFile}
                      projectRoot={project.path}
                      projectId={projectId}
                      threadId={codingThreadId}
                      selectedTaskId={selectedTaskId}
                      onThreadIdChange={setAgentThreadId}
                      onTodosChange={setAgentTodos}
                      activeTab={activeInspectorTab}
                    />
                  </CodingErrorBoundary>
                </div>
              </section>
              {/* Right: Code / Diff / Results / Review */}
              {showWorkbenchPane ? (
                <>
                  <PanelResizeHandle
                    ariaLabel="调整代码面板宽度"
                    onPointerDown={(event) => startPanelResize("right", event)}
                  />
                  <aside
                    data-testid="coding-workbench-right-panel"
                    className="shrink-0 overflow-hidden border-l"
                    style={{ width: rightPanelWidth }}
                  >
                    <div className="relative flex h-full min-h-0 flex-col">
                      <div className="bg-background/95 flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
                        <span className="text-muted-foreground truncate text-xs font-semibold tracking-wider uppercase">
                          {workbenchPanelTitle(workbenchView)}
                        </span>
                        <PanelToggleButton
                          ariaLabel="折叠代码面板"
                          title="折叠代码面板"
                          onClick={handleToggleWorkbenchPane}
                        >
                          <PanelRightCloseIcon className="h-4 w-4" />
                        </PanelToggleButton>
                      </div>
                      <div className="min-h-0 flex-1 overflow-hidden">
                        <CodingErrorBoundary
                          label={workbenchPanelTitle(workbenchView)}
                          resetKey={`${workbenchView}:${codingThreadId}:${selectedFile ?? ""}`}
                        >
                          {workbenchView === "code" && (
                            <CodeViewer
                              projectId={projectId}
                              filePath={selectedFile}
                            />
                          )}
                          {workbenchView === "changes" &&
                            showWorkbenchPane && (
                              <ScrollArea className="h-full">
                                <div className="flex flex-col">
                                  <CodingTaskChangesPanel
                                    threadId={codingThreadId}
                                    selectedFilePath={selectedFile}
                                    highlightedTaskId={selectedTaskId}
                                    onSelectTask={setSelectedTaskId}
                                    onFocusFile={focusWorkbenchFile}
                                  />
                                  <CodingDiffPanel
                                    projectId={projectId}
                                    selectedFilePath={selectedFile}
                                    focusLine={focusedLine}
                                  />
                                </div>
                              </ScrollArea>
                            )}
                          {workbenchView === "review" && showWorkbenchPane && (
                            <ReviewPanel
                              projectId={projectId}
                              projectRoot={project.path}
                              threadId={codingThreadId}
                              onThreadCreated={setAgentThreadId}
                              onFocusFile={focusWorkbenchFile}
                            />
                          )}
                        </CodingErrorBoundary>
                      </div>
                    </div>
                  </aside>
                </>
              ) : (
                <CollapsedSidePanelRail
                  ariaLabel="展开代码面板"
                  side="right"
                  title="展开代码面板"
                  onClick={handleToggleWorkbenchPane}
                >
                  <PanelRightOpenIcon className="h-4 w-4" />
                </CollapsedSidePanelRail>
              )}
            </div>
          </div>
          {terminalOpen && (
            <>
              <div
                onPointerDown={startTerminalResize}
                className="group bg-border/40 hover:bg-border relative h-1.5 shrink-0 cursor-row-resize transition-colors"
                role="separator"
                aria-orientation="horizontal"
                aria-label="调整终端高度"
              >
                <div className="bg-border/60 absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <EmbeddedTerminalTabsPanel
                activeId={activeTerminalId}
                tabs={terminalTabs}
                onActivate={setActiveTerminalId}
                onAdd={() => void handleOpenTerminal()}
                onClose={() => void handleCloseTerminalPanel()}
                onCloseTab={(sessionId) =>
                  void handleCloseTerminalTab(sessionId)
                }
                onCopyPath={() => void handleCopyTerminalPath()}
                onRegisterWriter={(sessionId, writer) => {
                  terminalWritersRef.current.set(sessionId, writer);
                }}
                onResize={(sessionId, cols, rows) =>
                  void resizeEmbeddedTerminal(sessionId, cols, rows)
                }
                onUnregisterWriter={(sessionId) => {
                  terminalWritersRef.current.delete(sessionId);
                }}
                onWrite={(sessionId, data) =>
                  void writeEmbeddedTerminal(sessionId, data)
                }
                height={terminalHeight}
              />
            </>
          )}
        </div>
      </div>
      <Dialog open={isCommitDialogOpen} onOpenChange={setCommitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>提交更改</DialogTitle>
            <DialogDescription>
              这会基于当前项目的真实 Git 状态执行一次提交。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="coding-commit-message"
              >
                提交说明
              </label>
              <Input
                id="coding-commit-message"
                value={commitMessage}
                placeholder="例如：refine coding workbench environment card"
                onChange={(event) => setCommitMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !commitMutation.isPending) {
                    event.preventDefault();
                    void handleCommit();
                  }
                }}
              />
            </div>
            <div className="bg-muted/50 rounded-md border px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">当前分支</span>
                <span className="font-mono">{gitBranch}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCommitDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={commitMutation.isPending || !commitMessage.trim()}
              onClick={() => void handleCommit()}
            >
              {commitMutation.isPending ? (
                <LoaderCircleIcon className="h-4 w-4 animate-spin" />
              ) : (
                <GitCommitHorizontalIcon className="h-4 w-4" />
              )}
              提交更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ArtifactsProvider>
  );
}

function WorkbenchToolbarButton({
  active,
  icon,
  label,
  onClick,
  shortLabel,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  shortLabel?: string;
}) {
  return (
    <button
      aria-label={label}
      aria-selected={active}
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "hover:bg-background/60 hover:text-foreground",
      )}
      role="tab"
      title={label}
      type="button"
      onClick={onClick}
    >
      {icon}
      <span className="hidden lg:inline">{shortLabel ?? label}</span>
    </button>
  );
}

function AgentInspectorToolbarButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-selected={active}
      className={cn(
        "inline-flex size-[26px] items-center justify-center rounded-sm p-0 transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "hover:bg-background/60 hover:text-foreground",
      )}
      role="tab"
      title={label}
      type="button"
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function PanelToggleButton({
  ariaLabel,
  children,
  onClick,
  title,
}: {
  ariaLabel: string;
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <Button
      aria-label={ariaLabel}
      className="size-7 shrink-0"
      size="icon-sm"
      title={title}
      type="button"
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function CollapsedSidePanelRail({
  ariaLabel,
  children,
  onClick,
  side,
  title,
}: {
  ariaLabel: string;
  children: React.ReactNode;
  onClick: () => void;
  side: "left" | "right";
  title: string;
}) {
  return (
    <div
      className={cn(
        "bg-background/95 flex w-9 shrink-0 items-start justify-center py-2",
        side === "left" ? "border-r" : "border-l",
      )}
    >
      <PanelToggleButton ariaLabel={ariaLabel} title={title} onClick={onClick}>
        {children}
      </PanelToggleButton>
    </div>
  );
}

function workbenchPanelTitle(
  view: "code" | "changes" | "review",
): string {
  switch (view) {
    case "changes":
      return "变更";
    case "review":
      return "Code Review";
    case "code":
    default:
      return "代码面板";
  }
}

function EmbeddedTerminalTabsPanel({
  activeId,
  tabs,
  onActivate,
  onAdd,
  onClose,
  onCloseTab,
  onCopyPath,
  onRegisterWriter,
  onResize,
  onUnregisterWriter,
  onWrite,
  height,
}: {
  activeId: string | null;
  tabs: EmbeddedTerminalTab[];
  onActivate: (sessionId: string) => void;
  onAdd: () => void;
  onClose: () => void;
  onCloseTab: (sessionId: string) => void;
  onCopyPath: () => void;
  onRegisterWriter: (sessionId: string, writer: (data: string) => void) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onUnregisterWriter: (sessionId: string) => void;
  onWrite: (sessionId: string, data: string) => void;
  height: number;
}) {
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null;

  return (
    <section
      aria-label="项目终端"
      className="bg-background flex shrink-0 flex-col border-t"
      style={{ height }}
      data-testid="embedded-project-terminal"
    >
      <div className="bg-muted/40 flex h-10 shrink-0 items-center gap-1 border-b px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={cn(
                "inline-flex h-7 max-w-[210px] shrink-0 items-center rounded-md text-xs transition-colors",
                activeTab?.id === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
              title={tab.cwd}
            >
              <button
                className="inline-flex h-full min-w-0 flex-1 items-center gap-1.5 px-2"
                type="button"
                onClick={() => onActivate(tab.id)}
              >
                <TerminalIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {tab.title || `终端 ${index + 1}`}
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    tab.running ? "bg-emerald-500" : "bg-muted-foreground/40",
                  )}
                />
              </button>
              <button
                aria-label={`关闭终端标签 ${index + 1}`}
                className="hover:bg-muted-foreground/10 mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded"
                title={`关闭终端 ${index + 1}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            aria-label="新建项目终端"
            className="size-7 shrink-0"
            size="icon-sm"
            title="新建项目终端"
            type="button"
            variant="ghost"
            onClick={onAdd}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
        {activeTab && (
          <span className="text-muted-foreground hidden max-w-[40vw] truncate font-mono text-xs lg:inline">
            {activeTab.cwd}
          </span>
        )}
        <Button
          aria-label="复制项目路径"
          className="size-7"
          size="icon-sm"
          title="复制项目路径"
          type="button"
          variant="ghost"
          onClick={onCopyPath}
        >
          <CopyIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          aria-label="关闭终端面板"
          className="size-7"
          size="icon-sm"
          title="关闭终端面板"
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="bg-background min-h-0 flex-1 overflow-hidden">
        {tabs.length > 0 ? (
          tabs.map((tab) => (
            <EmbeddedXtermViewport
              key={tab.id}
              active={activeTab?.id === tab.id}
              tab={tab}
              onRegisterWriter={onRegisterWriter}
              onResize={onResize}
              onUnregisterWriter={onUnregisterWriter}
              onWrite={onWrite}
            />
          ))
        ) : (
          <span className="text-muted-foreground">点击 + 新建项目终端</span>
        )}
      </div>
    </section>
  );
}

function EmbeddedXtermViewport({
  active,
  tab,
  onRegisterWriter,
  onResize,
  onUnregisterWriter,
  onWrite,
}: {
  active: boolean;
  tab: EmbeddedTerminalTab;
  onRegisterWriter: (sessionId: string, writer: (data: string) => void) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onUnregisterWriter: (sessionId: string) => void;
  onWrite: (sessionId: string, data: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { resolvedTheme } = useTheme();

  // Keep callback props in refs so the terminal-creation effect only
  // re-runs when `tab.id` changes — not on every parent re-render
  // (which would dispose the terminal and lose all screen content).
  const onRegisterWriterRef = useRef(onRegisterWriter);
  onRegisterWriterRef.current = onRegisterWriter;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const onUnregisterWriterRef = useRef(onUnregisterWriter);
  onUnregisterWriterRef.current = onUnregisterWriter;
  const onWriteRef = useRef(onWrite);
  onWriteRef.current = onWrite;

  /** Read the actual computed CSS custom-property value at runtime. */
  const readCssVar = useCallback((name: string): string => {
    if (typeof document === "undefined") return "";
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }, []);

  const getTerminalTheme = useCallback(
    () => ({
      background: readCssVar("--background") || "#0a0a0a",
      foreground: readCssVar("--foreground") || "#fafafa",
      cursor: readCssVar("--foreground") || "#fafafa",
      selectionBackground: readCssVar("--muted") || "#333333",
    }),
    [readCssVar],
  );

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;

    const terminal = new XTerm({
      allowProposedApi: false,
      convertEol: true,
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      scrollback: 5000,
      theme: getTerminalTheme(),
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    fitAddon.fit();
    onResizeRef.current(tab.id, terminal.cols, terminal.rows);
    terminal.focus();

    const dataDisposable = terminal.onData((data) =>
      onWriteRef.current(tab.id, data),
    );
    onRegisterWriterRef.current(tab.id, (data: string) => terminal.write(data));

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      onResizeRef.current(tab.id, terminal.cols, terminal.rows);
    });
    observer.observe(host);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      observer.disconnect();
      dataDisposable.dispose();
      onUnregisterWriterRef.current(tab.id);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [getTerminalTheme, tab.id]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      fitAddonRef.current?.fit();
      const terminal = terminalRef.current;
      if (terminal) {
        onResizeRef.current(tab.id, terminal.cols, terminal.rows);
        terminal.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active, tab.id]);

  // React to theme changes so the terminal background/foreground stays in
  // sync with the app theme without requiring a terminal restart.
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = getTerminalTheme();
  }, [getTerminalTheme, resolvedTheme]);

  return (
    <div
      className={cn("size-full p-2", !active && "hidden")}
      data-testid="embedded-project-terminal-viewport"
      ref={viewportRef}
    />
  );
}

function PanelResizeHandle({
  ariaLabel,
  onPointerDown,
}: {
  ariaLabel: string;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="group relative z-10 h-full w-2 shrink-0 cursor-col-resize touch-none"
      role="separator"
      tabIndex={0}
      onPointerDown={onPointerDown}
    >
      <div className="bg-border group-hover:bg-primary/60 absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors" />
    </div>
  );
}

function AgentInspector({
  activeTab,
  avoidRightFloatingPanels,
  onFocusFile,
  onTodosChange,
  onThreadIdChange,
  projectId,
  projectRoot,
  threadId,
  selectedTaskId,
}: {
  activeTab: AgentInspectorTab;
  avoidRightFloatingPanels?: boolean;
  onFocusFile?: WorkbenchFocusHandler;
  onTodosChange?: (todos: Todo[]) => void;
  projectId: string;
  projectRoot: string;
  threadId: string;
  selectedTaskId?: string | null;
  onThreadIdChange?: (threadId: string | undefined) => void;
}) {
  return (
    <div
      className="bg-background flex h-full min-h-0 flex-col border-l"
      data-testid="coding-agent-inspector"
    >
      <div className="relative mt-0 min-h-0 flex-1 overflow-hidden">
        <PersistentInspectorPanel active={activeTab === "agent"} keepMounted>
          <AgentPanel
            avoidRightFloatingPanels={avoidRightFloatingPanels}
            projectId={projectId}
            onFocusFile={onFocusFile}
            onThreadIdChange={onThreadIdChange}
            onTodosChange={onTodosChange}
          />
        </PersistentInspectorPanel>
        <PersistentInspectorPanel active={activeTab === "workflow"}>
          <CodingWorkflowInspector
            projectRoot={projectRoot}
            threadId={threadId}
          />
        </PersistentInspectorPanel>
      </div>
    </div>
  );
}

function CodingFloatingPanelStack({
  children,
  rightRailVisible,
}: {
  children: React.ReactNode;
  rightRailVisible: boolean;
}) {
  return (
    <div
      data-testid="coding-floating-panel-stack"
      className={cn(
        "pointer-events-none absolute top-3 z-20 flex w-[320px] max-w-[calc(100%-1.5rem)] flex-col gap-3 transition-all",
        rightRailVisible ? "right-12" : "right-3",
      )}
    >
      {children}
    </div>
  );
}

function EnvironmentInfoFloatingCard({
  ahead,
  branch,
  commitDisabled,
  commitPending,
  githubCli,
  head,
  onCommit,
  onPush,
  path,
  pushDisabled,
  pushPending,
  sourceLabel,
  sourceRemote,
  behind,
}: {
  ahead: number;
  branch: string;
  commitDisabled: boolean;
  commitPending: boolean;
  githubCli: {
    available: boolean;
    authenticated: boolean;
    username: string | null;
    host: string | null;
    detail: string | null;
  } | null;
  head: string | null;
  onCommit: () => void;
  onPush: () => void;
  path: string;
  pushDisabled: boolean;
  pushPending: boolean;
  sourceLabel: string;
  sourceRemote: string | null;
  behind: number;
}) {
  const githubConnected = githubCli?.available && githubCli?.authenticated;
  const githubLabel = githubConnected
    ? `${githubCli?.username ?? "已登录"} @ ${githubCli?.host ?? "github.com"}`
    : (githubCli?.detail ?? "GitHub CLI 未连接");

  return (
    <div
      data-testid="coding-environment-card"
      className={cn(
        "bg-background/96 pointer-events-auto w-full rounded-2xl border p-3 shadow-xl backdrop-blur",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
            环境信息
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{branch}</p>
          </div>
        </div>
        <div className="bg-muted/70 flex size-8 items-center justify-center rounded-xl border">
          <MonitorCogIcon className="text-muted-foreground h-4 w-4" />
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <InfoMetricTile
          label="同步"
          value={
            <span className="text-muted-foreground font-mono text-xs">
              ↑{ahead} ↓{behind}
            </span>
          }
        />

        <div className="bg-muted/40 rounded-xl border p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
              GitHub CLI
            </span>
            <Badge
              variant={githubConnected ? "default" : "secondary"}
              className="rounded-sm px-1.5 text-[10px]"
            >
              {githubConnected ? "已连接" : "未连接"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-lg border",
                githubConnected
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <GithubIcon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{githubLabel}</p>
              <p className="text-muted-foreground truncate text-[11px]">
                {head ? `HEAD ${head.slice(0, 8)}` : "未检测到 HEAD"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-muted/40 rounded-xl border p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
              来源
            </span>
            <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <CloudIcon className="h-3 w-3" />
              {sourceLabel}
            </div>
          </div>
          <p className="truncate text-xs font-medium">{path}</p>
          <p className="text-muted-foreground mt-1 truncate font-mono text-[11px]">
            {sourceRemote ?? "当前项目未配置远程仓库"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-start gap-2 rounded-xl"
            disabled={commitDisabled || commitPending}
            onClick={onCommit}
          >
            {commitPending ? (
              <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitCommitHorizontalIcon className="h-3.5 w-3.5" />
            )}
            提交更改
          </Button>
          <Button
            type="button"
            size="sm"
            className="justify-start gap-2 rounded-xl"
            disabled={pushDisabled || pushPending}
            onClick={onPush}
          >
            {pushPending ? (
              <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SendIcon className="h-3.5 w-3.5" />
            )}
            推送分支
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoMetricTile({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 rounded-xl border px-3 py-2">
      <p className="text-muted-foreground text-[11px] tracking-[0.08em] uppercase">
        {label}
      </p>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function PersistentInspectorPanel({
  active,
  children,
  keepMounted = false,
}: {
  active: boolean;
  children: React.ReactNode;
  keepMounted?: boolean;
}) {
  if (!active && !keepMounted) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 min-h-0 overflow-hidden",
        active ? "block" : "pointer-events-none hidden",
      )}
    >
      {children}
    </div>
  );
}

function CodingWorkflowInspector({
  projectRoot,
  threadId,
}: {
  projectRoot: string;
  threadId: string;
}) {
  const {
    skills,
    isLoading: skillsLoading,
    isFetching: skillsFetching,
    error: skillsError,
    refetch: refetchSkills,
  } = useCodingSkills(projectRoot);
  const { stages, isLoading: stagesLoading } = useDeliveryStages();
  const {
    stage: stageState,
    isFetching: stageFetching,
    refetch: refetchStage,
  } = useProjectStage(projectRoot);
  const setStage = useSetProjectStage(projectRoot);
  const acceptSuggestion = useAcceptStageSuggestion(projectRoot);
  const dismissSuggestion = useDismissStageSuggestion(projectRoot);
  const { session } = useCodingSession(threadId);
  const { review } = useLatestCodingReview(threadId);

  const skillsById = useMemo(() => {
    const map = new Map<string, CodingSkill>();
    for (const skill of skills) map.set(skill.id, skill);
    return map;
  }, [skills]);

  // Side-product signals — kept as advisory hints, NOT stage status.
  const signals = useMemo(
    () => ({
      hasChanges:
        getNumberValue(session?.change_summary ?? {}, "changed_files") > 0 ||
        getNumberValue(session?.change_summary ?? {}, "additions") > 0 ||
        getNumberValue(session?.change_summary ?? {}, "deletions") > 0,
      hasReview: Boolean(review),
    }),
    [review, session],
  );

  const isFetching = skillsFetching || stageFetching;
  const refetch = () => {
    void refetchSkills();
    void refetchStage();
  };
  const isLoading = skillsLoading || stagesLoading;
  const error = skillsError;

  return (
    <InspectorSection
      title="Workflow"
      meta="项目交付流程"
      isFetching={isFetching}
      onRefresh={refetch}
    >
      {isLoading ? (
        <InspectorSkeleton rows={5} />
      ) : error ? (
        <InspectorError message={getErrorMessage(error)} />
      ) : stages.length === 0 ? (
        <InspectorEmpty
          title="暂无 Workflow 数据"
          description="阶段定义加载后会在在这里展示。"
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 p-3">
            {/* Agent suggestion banner */}
            {stageState?.pending_suggestion && (
              <StageSuggestionBanner
                suggestion={stageState.pending_suggestion}
                stages={stages}
                isPending={
                  acceptSuggestion.isPending || dismissSuggestion.isPending
                }
                onAccept={() => acceptSuggestion.mutate()}
                onDismiss={() => dismissSuggestion.mutate()}
              />
            )}

            <div className="rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold">项目交付流程</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
                    {stageState?.current_stage
                      ? `当前阶段: ${currentStageTitle(stages, stageState)}`
                      : "点击阶段进入该阶段"}
                  </p>
                </div>
                {skillsById.get("project-delivery-workflow") && (
                  <Badge
                    variant="secondary"
                    className="rounded px-1.5 text-[10px]"
                  >
                    workflow
                  </Badge>
                )}
              </div>
              <div className="mt-2 grid gap-1.5">
                {stages.map((stage, index) => {
                  const isCurrent = stageState?.current_stage === stage.id;
                  const isVisited = stageState?.stage_history.some(
                    (h) => h.to_stage_id === stage.id,
                  );
                  return (
                    <WorkflowStageCard
                      key={stage.id}
                      stage={stage}
                      index={index + 1}
                      isCurrent={isCurrent}
                      isVisited={isVisited}
                      skillsById={skillsById}
                      signals={signals}
                      isPending={
                        setStage.isPending &&
                        setStage.variables?.stage_id === stage.id
                      }
                      onEnter={(reason) =>
                        setStage.mutate({ stage_id: stage.id, reason })
                      }
                    />
                  );
                })}
              </div>
            </div>

            {/* Stage transition history timeline (G3) */}
            {stageState && stageState.stage_history.length > 0 && (
              <StageHistoryTimeline
                history={stageState.stage_history}
                stages={stages}
              />
            )}
          </div>
        </ScrollArea>
      )}
    </InspectorSection>
  );
}

function currentStageTitle(
  stages: DeliveryStage[],
  state: ProjectStageState,
): string {
  const stage = stages.find((s) => s.id === state.current_stage);
  return stage?.title ?? state.current_stage ?? "";
}

function WorkflowStageCard({
  stage,
  index,
  isCurrent,
  isVisited,
  skillsById,
  signals,
  isPending,
  onEnter,
}: {
  stage: DeliveryStage;
  index: number;
  isCurrent: boolean;
  isVisited: boolean | undefined;
  skillsById: Map<string, CodingSkill>;
  signals: { hasChanges: boolean; hasReview: boolean };
  isPending: boolean;
  onEnter: (reason?: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const stageSkills = stage.recommended_skills;
  const available = stageSkills.filter((id) => skillsById.has(id));
  const enabled = available.filter((id) => skillsById.get(id)?.enabled).length;

  const statusLabel = isCurrent ? "当前阶段" : isVisited ? "已访问" : "未开始";

  // Advisory side-product signals (do NOT determine stage status).
  const signalLabel =
    stage.id === "implementation" && signals.hasChanges
      ? "检测到文件变更"
      : stage.id === "review" && signals.hasReview
        ? "有 review 记录"
        : null;

  return (
    <div
      className={cn(
        "bg-muted/30 rounded-md border px-2 py-1.5 transition-colors",
        isCurrent &&
          "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="bg-background text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded border font-mono text-[10px]">
          {index}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {stage.title}
        </span>
        <Badge
          variant={isCurrent ? "secondary" : "outline"}
          className={cn(
            "rounded px-1.5 text-[10px]",
            isCurrent &&
              "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
          )}
        >
          {statusLabel}
        </Badge>
        <span className="text-muted-foreground font-mono text-[10px]">
          {enabled}/{available.length}
        </span>
      </div>
      <p className="text-muted-foreground mt-1.5 text-[11px] leading-4">
        {stage.goal}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {stageSkills.map((id) => {
          const skill = skillsById.get(id);
          return (
            <Badge
              key={id}
              variant={skill?.enabled ? "secondary" : "outline"}
              className={cn(
                "rounded px-1.5 text-[10px]",
                !skill && "text-muted-foreground opacity-50",
              )}
            >
              {skill?.name ?? id}
            </Badge>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-6 rounded px-2 text-[10px] transition-colors"
              disabled={isPending}
              type="button"
              onClick={() => {
                onEnter();
                setConfirming(false);
              }}
            >
              {isPending ? "..." : "确认进入"}
            </button>
            <button
              className="text-muted-foreground hover:bg-muted hover:text-foreground h-6 rounded border px-2 text-[10px] transition-colors"
              type="button"
              onClick={() => setConfirming(false)}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            className={cn(
              "h-6 rounded border px-2 text-[10px] transition-colors",
              isCurrent
                ? "text-muted-foreground cursor-default opacity-50"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            disabled={isCurrent}
            type="button"
            onClick={() => setConfirming(true)}
          >
            {isCurrent ? "已是当前阶段" : "进入此阶段"}
          </button>
        )}
        <button
          className="text-muted-foreground hover:bg-muted hover:text-foreground h-6 rounded border px-2 text-[10px] transition-colors"
          type="button"
          onClick={() => void copyWorkflowPrompt(stage.suggested_prompt)}
        >
          复制提示词
        </button>
        {signalLabel && (
          <span className="text-muted-foreground text-[10px]">
            · {signalLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function StageSuggestionBanner({
  suggestion,
  stages,
  isPending,
  onAccept,
  onDismiss,
}: {
  suggestion: StageSuggestion;
  stages: DeliveryStage[];
  isPending: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const stage = stages.find((s) => s.id === suggestion.stage_id);
  const title = stage?.title ?? suggestion.stage_id;

  return (
    <div className="bg-primary/5 border-primary/20 rounded-md border p-2">
      <div className="flex items-start gap-2">
        <InfoIcon className="text-primary mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">Agent 建议进入【{title}】阶段</p>
          <p className="text-muted-foreground mt-0.5 text-[11px] leading-4">
            {suggestion.reason}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-6 rounded px-2 text-[10px] transition-colors"
          disabled={isPending}
          type="button"
          onClick={onAccept}
        >
          {isPending ? "..." : "接受并进入"}
        </button>
        <button
          className="text-muted-foreground hover:bg-muted hover:text-foreground h-6 rounded border px-2 text-[10px] transition-colors"
          disabled={isPending}
          type="button"
          onClick={onDismiss}
        >
          忽略
        </button>
      </div>
    </div>
  );
}

async function copyWorkflowPrompt(nextPrompt: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(nextPrompt);
  } catch {
    // Clipboard can be unavailable in some desktop/webview contexts.
  }
}

const SOURCE_LABELS: Record<string, string> = {
  user: "用户",
  agent_suggested: "Agent 建议",
  agent_accepted: "Agent 已接受",
};

const SOURCE_COLORS: Record<string, string> = {
  user: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  agent_suggested: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  agent_accepted:
    "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
};

function formatStageTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function StageHistoryTimeline({
  history,
  stages,
}: {
  history: StageHistoryEntry[];
  stages: DeliveryStage[];
}) {
  const stageTitle = (id: string | null) =>
    id ? (stages.find((s) => s.id === id)?.title ?? id) : "—";

  // Latest transitions first.
  const entries = [...history].reverse();

  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">阶段流转历史</p>
        <span className="text-muted-foreground text-[10px]">
          {history.length} 次转换
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        {entries.map((entry, idx) => {
          const isLatest = idx === 0;
          return (
            <div
              key={`${entry.to_stage_id}-${entry.timestamp}-${idx}`}
              className={cn(
                "rounded border px-2 py-1.5",
                isLatest ? "bg-muted/40" : "bg-transparent",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium">
                  {stageTitle(entry.from_stage_id)}
                </span>
                <ChevronRightIcon className="text-muted-foreground size-3 shrink-0" />
                <span className="text-[11px] font-semibold">
                  {stageTitle(entry.to_stage_id)}
                </span>
                {isLatest && (
                  <Badge
                    variant="secondary"
                    className="ml-auto rounded px-1.5 text-[9px]"
                  >
                    最新
                  </Badge>
                )}
              </div>
              {entry.reason && (
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[10px] leading-3.5">
                  {entry.reason}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded px-1 text-[9px]",
                    SOURCE_COLORS[entry.source] ?? "",
                  )}
                >
                  {SOURCE_LABELS[entry.source] ?? entry.source}
                </Badge>
                <span className="text-muted-foreground font-mono text-[9px]">
                  {formatStageTimestamp(entry.timestamp)}
                </span>
                {entry.thread_id && (
                  <span
                    className="text-muted-foreground max-w-[80px] truncate font-mono text-[9px]"
                    title={entry.thread_id}
                  >
                    @{entry.thread_id.slice(-8)}
                  </span>
                )}
                {entry.run_outcome && (
                  <Badge variant="outline" className="rounded px-1 text-[9px]">
                    {entry.run_outcome}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InspectorSection({
  action,
  children,
  isFetching,
  meta,
  onRefresh,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  isFetching: boolean;
  meta?: string;
  onRefresh: () => void;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{title}</p>
          {meta && <p className="text-muted-foreground text-[11px]">{meta}</p>}
        </div>
        {action}
        <Button
          className="size-7"
          disabled={isFetching}
          size="icon"
          title="刷新"
          type="button"
          variant="ghost"
          onClick={onRefresh}
        >
          <RefreshCwIcon
            className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
          />
        </Button>
      </div>
      {children}
    </div>
  );
}

function InspectorSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

function InspectorError({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center">
      <p className="text-destructive text-xs">{message}</p>
    </div>
  );
}

function InspectorEmpty({
  description,
  title,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
      <div className="bg-muted/60 flex h-10 w-10 items-center justify-center rounded-md">
        <ActivityIcon className="text-muted-foreground h-5 w-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-56 text-xs leading-5">
        {description}
      </p>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "加载失败";
}

function normalizeProjectFilePath(
  filePath: string,
  projectRoot: string,
): string {
  const trimmedPath = filePath.trim();
  const trimmedRoot = projectRoot.trim().replace(/\/+$/, "");
  if (!trimmedPath || !trimmedRoot) return trimmedPath || filePath;
  if (trimmedPath === trimmedRoot) return trimmedPath;
  const rootPrefix = `${trimmedRoot}/`;
  if (trimmedPath.startsWith(rootPrefix)) {
    return trimmedPath.slice(rootPrefix.length);
  }
  return trimmedPath;
}

function getNumberValue(value: Record<string, unknown>, key: string): number {
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}
