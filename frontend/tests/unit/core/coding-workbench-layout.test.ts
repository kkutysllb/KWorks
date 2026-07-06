import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("coding workbench layout", () => {
  test("workspace sidebar uses a global titlebar instead of collapsed logo rail", () => {
    const header = readFileSync(
      resolve(repoRoot, "src/components/workspace/workspace-header.tsx"),
      "utf8",
    );

    expect(header).toContain('data-testid="workspace-sidebar-trigger"');
    expect(header).toContain("desktop-titlebar-drag");
    expect(header).not.toContain("group-hover/workspace-header:hidden");
    expect(header).not.toContain("group-hover/workspace-header:block");
    expect(header).toContain('state === "collapsed" && "pl-[72px]"');
  });

  test("coding workbench places panel controls in the sidebar headers", () => {
    const workbench = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/coding-workbench.tsx"),
      "utf8",
    );

    expect(workbench).not.toContain("CollapsedPanelRestore");
    expect(workbench).not.toContain("left-panel-toggle");
    expect(workbench).not.toContain("left-panel-toggle-expanded");
    expect(workbench).not.toContain("right-panel-toggle-expanded");
    // The decorative "穷奇引擎" header row was removed to reclaim vertical
    // space; the inspector tab switcher is now an overlaid icon toolbar.
    expect(workbench).not.toContain("穷奇引擎 / QiongQi Engine");
    expect(workbench).not.toContain("QiongQi Engine Agent Inspector");
    expect(workbench).not.toContain("穷奇引擎智能体检查器");
    expect(workbench).toContain("showFileExplorer");
    expect(workbench).toContain("showWorkbenchPane");
    expect(workbench).toContain("openWorkbenchPane");
    expect(workbench).toContain("closeWorkbenchPane");
    expect(workbench).toContain(
      "const [leftCollapsed, setLeftCollapsed] = useState(false)",
    );
    expect(workbench).toContain(
      "const [rightCollapsed, setRightCollapsed] = useState(true)",
    );
    expect(workbench).toContain("environmentCardCollapsed");
    expect(workbench).toContain("useState(false)");
    expect(workbench).toContain(
      "const showEnvironmentCard = !showWorkbenchPane && !environmentCardCollapsed",
    );
    expect(workbench).toContain("LEFT_PANEL_DEFAULT_WIDTH = 320");
    expect(workbench).toContain("LEFT_PANEL_MIN_WIDTH = 240");
    expect(workbench).toContain("LEFT_PANEL_MAX_WIDTH = 520");
    expect(workbench).toContain("RIGHT_PANEL_DEFAULT_WIDTH = 640");
    expect(workbench).toContain("RIGHT_PANEL_MIN_WIDTH = 420");
    expect(workbench).toContain("RIGHT_PANEL_MAX_WIDTH = 1120");
    expect(workbench).toContain("leftPanelWidth");
    expect(workbench).toContain("rightPanelWidth");
    expect(workbench).toContain("startPanelResize");
    expect(workbench).toContain('window.addEventListener("pointermove"');
    expect(workbench).toContain("PanelResizeHandle");
    expect(workbench).not.toContain("PanelImperativeHandle");
    expect(workbench).not.toContain("ResizablePanelGroup");
    expect(workbench).not.toContain("ResizablePanel");
    expect(workbench).not.toContain("ResizableHandle");
    expect(workbench).toContain("{showFileExplorer ? (");
    expect(workbench).toContain("style={{ width: leftPanelWidth }}");
    expect(workbench).toContain("style={{ width: rightPanelWidth }}");
    expect(workbench).not.toContain("xl:pr-[340px] 2xl:pr-[360px]");
    expect(workbench).toContain("CodingFloatingPanelStack");
    expect(workbench).toContain("showFloatingPanels");
    expect(workbench).toContain("agentTodos.length > 0");
    expect(workbench).toContain("onTodosChange={setAgentTodos}");
    expect(workbench).toContain("todos={agentTodos}");
    expect(workbench).toContain('data-testid="coding-workbench-right-panel"');
    expect(workbench).toContain("const [workbenchView, setWorkbenchView]");
    expect(workbench).toContain("AgentInspectorTabTrigger");
    expect(workbench).toContain("Agent 检查器视图");
    expect(workbench).toContain("absolute top-1.5 left-2 z-30");
    expect(workbench).toContain("size-[26px] flex-none");
    expect(workbench).toContain('<span className="sr-only">{label}</span>');
    expect(workbench).not.toContain("grid-cols-5");
    expect(workbench).not.toContain("sm:mr-1");
    expect(workbench).toContain('value="agent"');
    expect(workbench).toContain("PersistentInspectorPanel");
    expect(workbench).toContain(
      '<PersistentInspectorPanel active={activeTab === "agent"} keepMounted>',
    );
    expect(workbench).toContain("if (!active && !keepMounted)");
    expect(workbench).toContain('value="events"');
    expect(workbench).toContain('value="session"');
    expect(workbench).not.toContain('value="roi"');
    expect(workbench).toContain('value="workflow"');
    expect(workbench).toContain('value="skills"');
    expect(workbench).toContain("CodingEventsInspector");
    expect(workbench).toContain("CodingSessionInspector");
    expect(workbench).toContain("useCodingSessionChanges(threadId)");
    expect(workbench).toContain("effectiveChangeSummary");
    expect(workbench).toContain("buildChangeSummaryFromChanges");
    expect(workbench).not.toContain("CodingRoiInspector");
    expect(workbench).not.toContain("useCodingRoiSummary");
    expect(workbench).not.toContain("useCodingRoiReports");
    expect(workbench).not.toContain("QiongqiRoiReport");
    expect(workbench).not.toContain("RoiTrendSparkline");
    expect(workbench).not.toContain("RoiSavingsDonut");
    expect(workbench).not.toContain("RoiContributionBars");
    expect(workbench).not.toContain("RoiCostBreakdown");
    expect(workbench).toContain("CodingWorkflowInspector");
    expect(workbench).toContain("CodingSkillsInspector");
    expect(workbench).toContain("useCodingSessionEvents");
    expect(workbench).toContain("useCodingSession");
    expect(workbench).toContain("useCodingSkills");
    expect(workbench).not.toContain("useSetCodingSkillEnabled");
    expect(workbench).toContain("<Switch");
    expect(workbench).toContain("disabled");
    expect(workbench).toContain("event.stopPropagation()");
    expect(workbench).not.toContain("onCheckedChange={onToggle}");
    expect(workbench).toContain("内置技能");
    expect(workbench).toContain("activationKeywordsForSkill(skill)");
    expect(workbench).toContain(".slice(0, 4)");
    expect(workbench).not.toContain("skill.activation_keywords.slice(0, 4)");
    expect(workbench).toContain("SKILL_CATEGORIES");
    expect(workbench).toContain("useDeliveryStages");
    expect(workbench).toContain("copyWorkflowPrompt");
    expect(workbench).toContain("复制提示词");
    expect(workbench).toContain("nextPrompt");
    expect(workbench).toContain("goal");
    expect(workbench).toContain("filteredSkills");
    expect(workbench).toContain("setSkillSearch");
    expect(workbench).toContain("项目交付流程");
    expect(workbench).toContain("全部分类");
    expect(workbench).toContain("WorkflowStageCard");
    expect(workbench).toContain("SkillCategoryFilter");
    expect(workbench).toContain("const signals = useMemo");
    expect(workbench).toContain("isCurrent={isCurrent}");
    expect(workbench).toContain("isVisited={isVisited}");
    expect(workbench).toContain("signals={signals}");
    expect(workbench).toContain("运行概览");
    expect(workbench).toContain("当前任务");
    expect(workbench).toContain("变更摘要");
    expect(workbench).toContain("活跃技能");
    expect(workbench).toContain("工具策略");
    expect(workbench).toContain("ROI 摘要");
    expect(workbench).toContain("原始 Session");
    expect(workbench).toContain("expandedRawSession");
    expect(workbench).not.toContain("useCodingSkillDetail");
    expect(workbench).not.toContain("useCreateCodingSkill");
    expect(workbench).not.toContain("useUpdateCodingSkill");
    expect(workbench).not.toContain("useDeleteCodingSkill");
    expect(workbench).not.toContain("selectedSkillDetail");
    expect(workbench).not.toContain("SkillEditorForm");
    expect(workbench).not.toContain("startCreateSkill");
    expect(workbench).not.toContain("startEditSkill");
    expect(workbench).not.toContain("submitSkillForm");
    expect(workbench).not.toContain("deleteSelectedSkill");
    expect(workbench).not.toContain("确认删除项目 Coding Skill");
    expect(workbench).not.toContain("选择一个 skill 查看说明");
    expect(workbench).not.toContain(">新建<");
    expect(workbench).not.toContain(">编辑<");
    expect(workbench).not.toContain(">删除<");
    expect(workbench).toContain("focusWorkbenchFile");
    expect(workbench).toContain("handleSelectExplorerFile");
    expect(workbench).toContain("onFocusFile");
    expect(workbench).toContain("getEventFocusTarget");
    expect(workbench).toContain("CodingTaskChangesPanel");
    expect(workbench).toContain('label="任务变更"');
    expect(workbench).toContain('label="Code Review"');
    expect(workbench).toContain('handleSelectWorkbenchTab("task-changes")');
    expect(workbench).toContain('handleSelectWorkbenchTab("review")');
    expect(workbench).toContain('event.event_type === "file_changed"');
    expect(workbench).toContain('event.event_type === "diff_summarized"');
    expect(workbench).toContain('target: WorkbenchFocusTarget = "code"');
    expect(workbench).toContain("openWorkbenchPane()");
    expect(workbench).not.toContain('setActiveInspectorTab("events")');
    expect(workbench).not.toContain("后续接入 Qiongqi");
    expect(workbench).not.toContain("InspectorPlaceholder");
    expect(workbench).not.toContain("absolute top-1/2");
    expect(workbench).not.toContain("forceMount");
    expect(workbench).not.toContain("{/* Panel collapse toggles */}");
  });

  test("coding workbench keeps code-view and review controls in the header", () => {
    const workbench = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/coding-workbench.tsx"),
      "utf8",
    );

    // The tab group + environment + terminal buttons live in the header row
    // (moved out of a separate toolbar row to reclaim vertical space).
    expect(workbench).toContain('data-testid="coding-workbench-toolbar"');
    expect(workbench).toContain('aria-label="代码区视图"');
    expect(workbench).toContain("inline-flex h-7 w-fit max-w-full shrink-0");
    expect(workbench).toContain('shortLabel="变更"');
    expect(workbench).toContain('shortLabel="Diff"');
    expect(workbench).toContain('shortLabel="Review"');
    expect(workbench).toContain('<span className="hidden lg:inline">');
    expect(workbench).toContain('aria-label="切换环境信息面板"');
    expect(workbench).toContain(
      "setEnvironmentCardCollapsed((value) => !value)",
    );
    expect(workbench).toContain("MonitorCogIcon");
    expect(workbench).toContain('aria-label="新建项目终端"');
    expect(workbench).not.toContain('aria-label="打开项目终端"');
    expect(workbench).toContain("PlusIcon");
    expect(workbench).not.toContain('aria-label="切换文件树"');
    expect(workbench).not.toContain('aria-label="切换代码面板"');
    expect(workbench).toContain("PanelToggleButton");
    expect(workbench).toContain("CollapsedSidePanelRail");
    expect(workbench).toContain('ariaLabel="折叠文件浏览器"');
    expect(workbench).toContain('ariaLabel="展开文件浏览器"');
    expect(workbench).toContain('ariaLabel="折叠代码面板"');
    expect(workbench).toContain('ariaLabel="展开代码面板"');
    expect(workbench).toContain("PanelLeftCloseIcon");
    expect(workbench).toContain("PanelRightCloseIcon");
    expect(workbench).toContain("rightRailVisible");
    expect(workbench).toContain("openProjectTerminal(project.path)");
    expect(workbench).toContain("startEmbeddedTerminal(project.path)");
    expect(workbench).toContain("EmbeddedTerminalTabsPanel");
    expect(workbench).toContain('data-testid="embedded-project-terminal"');
    expect(workbench).toContain(
      'data-testid="embedded-project-terminal-viewport"',
    );
    expect(workbench).toContain("Terminal as XTerm");
    expect(workbench).toContain("FitAddon");
    expect(workbench).toContain("onWriteRef.current(tab.id, data)");
    expect(workbench).toContain("void writeEmbeddedTerminal(sessionId, data)");
    expect(workbench).toContain("fitAddon.fit()");
    expect(workbench).toContain(
      "void resizeEmbeddedTerminal(sessionId, cols, rows)",
    );
    expect(workbench).toContain("terminalTabs");
    expect(workbench).toContain("activeTerminalId");
    expect(workbench).toContain("onAdd={() => void handleOpenTerminal()}");
    expect(workbench).toContain("aria-label={`关闭终端标签 ${index + 1}`}");
    expect(workbench).toContain("event.stopPropagation()");
    expect(workbench).not.toContain('aria-label="终端命令"');
    expect(workbench).not.toContain('aria-label="关闭当前终端"');
    expect(workbench).not.toContain("bg-[#111]");
    expect(workbench).not.toContain("text-zinc-100");
    expect(workbench).not.toContain("KWorks embedded terminal");
    expect(workbench).toContain("handleOpenTerminal");
    expect(workbench).toContain("handleCloseTerminalPanel");
    expect(workbench).toContain("handleToggleFileExplorer");
    expect(workbench).toContain("handleToggleWorkbenchPane");
    expect(workbench).toContain("PanelLeftOpenIcon");
    expect(workbench).toContain("PanelRightOpenIcon");
    expect(workbench).toContain("WorkbenchToolbarButton");
    expect(workbench).toContain('activeCodeTab === "review"');
    expect(workbench).toContain("<ReviewPanel");
    expect(workbench).toContain('label="Code Review"');
    expect(workbench).toContain("EnvironmentInfoFloatingCard");
    expect(workbench).toContain("{showFloatingPanels && (");
    expect(workbench).toContain("{showEnvironmentCard && (");
    expect(workbench).toContain("gitBranch");
    expect(workbench).toContain("useProjectEnvironment");
    expect(workbench).toContain("useCodingSessionChanges");
    expect(workbench).toContain("const taskChangeSummary = useMemo");
    expect(workbench).toContain("const reviewChangeSummary = reviewSummary");
    expect(workbench).toContain(
      "reviewChangeSummary.additions || taskChangeSummary.additions",
    );
    expect(workbench).toContain(
      "reviewChangeSummary.deletions || taskChangeSummary.deletions",
    );
    expect(workbench).toContain(
      "reviewChangeSummary.changedFiles || taskChangeSummary.changedFiles",
    );
    expect(workbench).toContain("review?.summary");
    expect(workbench).toContain("useProjectGitCommit");
    expect(workbench).toContain("useProjectGitPush");
    expect(workbench).toContain("githubCli");
    expect(workbench).toContain("sourceLabel");
    expect(workbench).toContain("onCommit");
    expect(workbench).toContain("onPush");
    expect(workbench).toContain("GitHub CLI");
    expect(workbench).toContain("提交更改");
    expect(workbench).toContain("推送分支");
    expect(workbench).toContain("来源");
    expect(workbench).not.toContain("activeWorkbenchTab");
    expect(workbench).not.toContain("setActiveWorkbenchTab");
    expect(workbench).not.toContain('label="浏览器"');
    expect(workbench).not.toContain('aria-label="Coding 工作模式"');
    expect(workbench).not.toContain('<Tabs defaultValue="code"');
    expect(workbench).not.toContain('className="mx-3 mt-2 w-fit shrink-0"');
  });

  test("review panel exposes PR review and one-click fix workflow controls", () => {
    const panel = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/review-panel.tsx"),
      "utf8",
    );

    expect(panel).toContain("useApplyCodingReviewFix");
    expect(panel).toContain('startReview("pr")');
    expect(panel).toContain("PR 审查");
    expect(panel).toContain('currentReview.scope === "pr"');
    expect(panel).toContain("reviewSummary.commits");
    expect(panel).toContain("ReviewPrContext");
    expect(panel).toContain("getReviewPrContext");
    expect(panel).toContain("findingSeverityFilter");
    expect(panel).toContain("filteredFindings");
    expect(panel).toContain("Patch 预览");
    expect(panel).toContain("expandedPatchFindingId");
    expect(panel).toContain("ReviewErrorNotice");
    expect(panel).toContain("请求目标");
    expect(panel).toContain("可能原因");
    expect(panel).toContain("finding.fix?.applicable");
    expect(panel).toContain("一键应用");
    expect(panel).toContain("自动修复已应用");
    expect(panel).toContain("applyFix.mutate");
    expect(panel).toContain("applyFix.error");
  });
});
