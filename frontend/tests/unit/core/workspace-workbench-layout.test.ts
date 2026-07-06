import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("workspace workbench layout", () => {
  test("sidebar separates focused actions from project task history", () => {
    const sidebar = readFileSync(
      resolve(repoRoot, "src/components/workspace/workspace-sidebar.tsx"),
      "utf8",
    );
    const nav = readFileSync(
      resolve(repoRoot, "src/components/workspace/workspace-nav-chat-list.tsx"),
      "utf8",
    );

    expect(sidebar).toContain("WorkspaceSpacesSection");
    expect(sidebar).toContain("WorkspaceTasksSection");
    expect(sidebar).toContain("HistoryTaskList");
    expect(sidebar).not.toContain("RecentChatList");
    expect(nav).toContain("功能区");
    expect(nav).toContain("项目 / 任务");
    expect(nav).toContain("新任务");
    expect(nav).toContain("技能");
    expect(nav).toContain("自动化");
    expect(nav).toContain('href="/workspace/chats/new"');
    expect(nav).toContain('href="/workspace/skills"');
    expect(nav).toContain('href="/workspace/mcp"');
    expect(nav).toContain("/workspace/crons");
    expect(nav).toContain("/workspace/token-usage");
    expect(nav).not.toContain('href="/workspace"');
    expect(nav).not.toContain('href="/workspace/channels"');
    expect(nav).not.toContain('href="/workspace/agents"');
    expect(nav).toContain('href="/workspace/coding"');
  });

  test("history task switching avoids browser-level reloads inside an existing workspace shell", () => {
    const historyTaskList = readFileSync(
      resolve(repoRoot, "src/components/workspace/history-task-list.tsx"),
      "utf8",
    );

    expect(historyTaskList).toContain("navigateWorkspaceInPlace");
    expect(historyTaskList).not.toContain("window.location.assign");
  });

  test("workspace root redirects to the new task surface instead of rendering a workbench", () => {
    const workspacePage = readFileSync(
      resolve(repoRoot, "src/app/workspace/page.tsx"),
      "utf8",
    );

    expect(workspacePage).toContain('redirect("/workspace/chats/new")');
    expect(workspacePage).not.toContain("WORKSPACE_ACTIONS");
    expect(workspacePage).not.toContain("QiongQi 工作台");
  });

  test("settings route owns the full workspace chrome instead of nesting sidebars", () => {
    const content = readFileSync(
      resolve(repoRoot, "src/app/workspace/workspace-content.tsx"),
      "utf8",
    );

    expect(content).toContain('pathname === "/workspace/settings"');
    expect(content).toContain("isSettingsRoute");
    expect(content).toContain("isSettingsRoute ? (");
    expect(content).toContain("<SettingsLayoutProvider syncHash>");
    expect(content).toContain("<SettingsSidebar />");
    expect(content).toContain('<SidebarInset className="min-w-0">');
    expect(content).not.toContain("<>{children}</>");
  });

  test("coding route renders the coding project workbench entry", () => {
    const codingPage = readFileSync(
      resolve(repoRoot, "src/app/workspace/coding/page.tsx"),
      "utf8",
    );
    const chatPage = readFileSync(
      resolve(repoRoot, "src/app/workspace/chats/[thread_id]/page.tsx"),
      "utf8",
    );

    expect(codingPage).toContain("ProjectGallery");
    expect(codingPage).not.toContain("redirect");
    expect(codingPage).not.toContain("/workspace/chats/new?mode=coding");
    expect(chatPage).toContain('router.replace("/workspace/coding")');
    expect(chatPage).toContain('searchParams.get("workModeId") ?? "task"');
  });

  test("workspace sidebar owns the single KWorks brand while header keeps window controls", () => {
    const header = readFileSync(
      resolve(repoRoot, "src/components/workspace/workspace-header.tsx"),
      "utf8",
    );
    const content = readFileSync(
      resolve(repoRoot, "src/app/workspace/workspace-content.tsx"),
      "utf8",
    );
    const sidebar = readFileSync(
      resolve(repoRoot, "src/components/workspace/workspace-sidebar.tsx"),
      "utf8",
    );

    expect(header).toContain("desktop-titlebar-drag");
    expect(header).toContain("items-start");
    expect(header).toContain("pt-1.5");
    expect(header).toContain("useSidebar");
    expect(header).toContain('state === "collapsed" && "pl-[72px]"');
    expect(header).not.toContain("peer-data-[state=collapsed]:pl-[72px]");
    expect(header).not.toContain("KWorks");
    expect(header).not.toContain("WorkspaceBrand");
    expect(content).toContain("WorkspaceHeader");
    expect(content).toContain("defaultOpen={true}");
    expect(sidebar).toContain("WorkspaceBrand");
    expect(sidebar).toContain("pl-[72px]");
    expect(sidebar).toContain('collapsible="offcanvas"');
    expect(sidebar).not.toContain('collapsible="icon"');
    expect(sidebar).not.toContain("WorkspaceHeader");
  });

  test("chat shell keeps result panel hidden until artifacts are opened", () => {
    const chatBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/chats/chat-box.tsx"),
      "utf8",
    );

    expect(chatBox).toContain("ResultPanelEmptyState");
    expect(chatBox).toContain('aria-label="关闭结果面板"');
    expect(chatBox).toContain("结果文件");
    expect(chatBox).toContain(
      'artifactPanelOpen ? "translate-x-0" : "translate-x-full"',
    );
    expect(chatBox).toContain(
      '!artifactPanelOpen && "pointer-events-none hidden opacity-0"',
    );
    expect(chatBox).toContain("defaultLayout={{ chat: 100, artifacts: 0 }}");
  });

  test("chat pages gently offset content when the floating todo panel is expanded", () => {
    const chatPage = readFileSync(
      resolve(repoRoot, "src/app/workspace/chats/[thread_id]/page.tsx"),
      "utf8",
    );

    expect(chatPage).toContain("todoPanelOccupiesSpace");
    expect(chatPage).toContain(
      "onFloatingVisibilityChange={setTodoPanelOccupiesSpace}",
    );
    expect(chatPage).toContain("todoPanelContentOffsetClass");
    expect(chatPage).toContain("xl:-translate-x-20");
    expect(chatPage).not.toContain("xl:pr-[24rem]");
  });

  test("welcome surface no longer advertises legacy KWorks or runtime copy", () => {
    const welcome = readFileSync(
      resolve(repoRoot, "src/components/workspace/welcome.tsx"),
      "utf8",
    );
    const zh = readFileSync(
      resolve(repoRoot, "src/core/i18n/locales/zh-CN.ts"),
      "utf8",
    );
    const en = readFileSync(
      resolve(repoRoot, "src/core/i18n/locales/en-US.ts"),
      "utf8",
    );

    expect(welcome).not.toContain("runtime");
    expect(zh).toContain("欢迎使用 KWorks");
    expect(zh).toContain("QiongQi");
    expect(en).toContain("Welcome to KWorks");
    expect(en).toContain("QiongQi");
  });

  test("qiongqi input controls keep work mode, task mode, execution profile, and collaboration policy separate", () => {
    const inputBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/input-box.tsx"),
      "utf8",
    );
    const skillsHooks = readFileSync(
      resolve(repoRoot, "src/core/skills/hooks.ts"),
      "utf8",
    );
    const hooks = readFileSync(
      resolve(repoRoot, "src/core/threads/hooks.ts"),
      "utf8",
    );
    const workModes = readFileSync(
      resolve(repoRoot, "src/core/skills/work-modes.ts"),
      "utf8",
    );

    expect(skillsHooks).toContain("useWorkModes");
    expect(inputBox).toContain('type TaskMode = "agent" | "plan"');
    expect(inputBox).toContain(
      'type ExecutionProfile = "fast" | "balanced" | "deep"',
    );
    expect(inputBox).toContain('type CollaborationPolicy = "single" | "auto"');
    expect(inputBox).toContain("QiongQiTaskModeMenu");
    expect(inputBox).toContain("QiongQiCollaborationMenu");
    expect(inputBox).toContain("WorkModeTabs");
    expect(inputBox).toContain('router.push("/workspace/coding")');
    expect(inputBox).toContain("useWorkModes");
    expect(inputBox).toContain("workModes.map");
    expect(inputBox).toContain("workModeDisplayName(workMode)");
    expect(inputBox).toContain("showSkillCreateBindingHint");
    expect(inputBox).toContain("新技能将自动绑定到当前工作模式");
    expect(inputBox).toContain("selectedWorkModeLabel");
    expect(inputBox).toContain("InputBoxSubmitContext");
    expect(inputBox).toContain("onSubmit?.(");
    expect(inputBox).toContain(
      "contextForWorkMode(context, workModeId, supportThinking)",
    );
    expect(inputBox).not.toContain("{workMode.name || workMode.id}");
    expect(inputBox).toContain("workModeId");
    expect(inputBox).not.toContain('type SurfaceMode = "task" | "coding"');
    expect(inputBox).not.toContain("任务模式");
    expect(workModes).toContain('name: "日常办公"');
    expect(workModes).toContain('name: "Coding 模式"');
    expect(workModes).toContain('if (mode.id === "task") return "日常办公"');
    expect(inputBox).toContain("选择工作空间");
    expect(inputBox).toContain("打开本地目录");
    expect(inputBox).toContain("历史任务目录");
    expect(inputBox).toContain("pickDirectory");
    expect(inputBox).toContain("useThreads");
    expect(inputBox).toContain("historyThread.context?.workspaceRoot");
    expect(inputBox).toContain("isSelectedWorkspaceRoot");
    expect(inputBox).toContain("if (isSelectedWorkspaceRoot(value))");
    expect(inputBox).toContain("协作策略");
    expect(inputBox).not.toContain("多代理协作");
    expect(hooks).toContain("delete submitContext.sandboxMode");
    expect(hooks).toContain("qiongqiModeForSubmitContext");
    expect(hooks).toContain(
      'is_plan_mode: mode === "plan"',
    );
    expect(hooks).toContain(
      'subagent_enabled: submitContext.collaborationPolicy === "auto"',
    );
    expect(hooks).toContain("workModeId: submitContext.workModeId");
    expect(hooks).toContain("...context,\n          ...extraContext");
    expect(hooks).not.toContain(
      'context.mode === "pro" || context.mode === "ultra"',
    );
  });

  test("new chat submits the resolved work mode context from the input box", () => {
    const chatPage = readFileSync(
      resolve(repoRoot, "src/app/workspace/chats/[thread_id]/page.tsx"),
      "utf8",
    );

    expect(chatPage).toContain("type InputBoxSubmitContext");
    expect(chatPage).toContain("urlWorkModeId");
    expect(chatPage).toContain("chatContext");
    expect(chatPage).toContain("context: chatContext");
    expect(chatPage).toContain("context={chatContext}");
    expect(chatPage).toContain(
      "(message: PromptInputMessage, submitContext: InputBoxSubmitContext)",
    );
    expect(chatPage).toContain("sendMessage(threadId, message, submitContext)");
  });

  test("settings dialog does not duplicate MCP under an external tools section", () => {
    const dialog = readFileSync(
      resolve(
        repoRoot,
        "src/components/workspace/settings/settings-dialog.tsx",
      ),
      "utf8",
    );

    expect(dialog).not.toContain('id: "tools"');
    expect(dialog).not.toContain("ToolSettingsPage");
  });

  test("settings menu promotes user-visible QiongQi config groups to top-level entries", () => {
    const layoutState = readFileSync(
      resolve(
        repoRoot,
        "src/components/workspace/settings/settings-layout-state.tsx",
      ),
      "utf8",
    );
    const shell = readFileSync(
      resolve(
        repoRoot,
        "src/components/workspace/settings/settings-page-shell.tsx",
      ),
      "utf8",
    );
    const navMenu = readFileSync(
      resolve(repoRoot, "src/components/workspace/workspace-nav-menu.tsx"),
      "utf8",
    );
    const userInfo = readFileSync(
      resolve(repoRoot, "src/components/workspace/workspace-user-info.tsx"),
      "utf8",
    );

    expect(layoutState).toContain("qiongqi-models");
    expect(layoutState).toContain("qiongqi-context");
    expect(layoutState).toContain("qiongqi-storage");
    expect(layoutState).toContain("qiongqi-observability");
    expect(layoutState).toContain("qiongqi-mcp");
    expect(layoutState).toContain("qiongqi-web");
    expect(layoutState).toContain("qiongqi-skills");
    expect(layoutState).toContain("qiongqi-subagents");
    expect(layoutState).not.toContain("qiongqi-attachments");
    expect(shell).toContain("showNav={false}");
    expect(shell).toContain("ConfigWriteStatus");
    expect(shell).toContain("configWriteStatus");
    expect(shell).toContain("onWriteStatusChange={setConfigWriteStatus}");
    expect(shell).not.toContain("NotificationSettingsPage");
    expect(shell).not.toContain('id: "notification"');
    expect(shell).not.toContain("MemorySettingsPage");
    expect(shell).not.toContain('id: "memory"');
    expect(shell).not.toContain("SkillModelsSettingsPage");
    expect(shell).not.toContain("skillModels");
    expect(shell).not.toContain("模型凭证");
    expect(navMenu).not.toContain("notification");
    expect(navMenu).not.toContain("BellIcon");
    expect(navMenu).not.toContain('id: "memory"');
    expect(navMenu).not.toContain('labelKey: "memory"');
    expect(userInfo).not.toContain("notification");
    expect(userInfo).not.toContain("BellIcon");
    expect(userInfo).not.toContain('id: "memory"');
    expect(userInfo).not.toContain('labelKey: "memory"');
  });

  test("workspace user menu exposes one settings item before logout", () => {
    const userInfo = readFileSync(
      resolve(repoRoot, "src/components/workspace/workspace-user-info.tsx"),
      "utf8",
    );

    expect(userInfo).toContain("{t.settings.title}");
    expect(userInfo).toContain("<SettingsIcon");
    expect(userInfo).toContain('router.push("/workspace/settings")');
    expect(userInfo).not.toContain("SettingsDialog");
    expect(userInfo).not.toContain("SETTINGS_ITEMS");
    expect(userInfo).not.toContain("PaletteIcon");
  });

  test("qiongqi engine settings hide manual runtime and service entry controls", () => {
    const settings = readFileSync(
      resolve(
        repoRoot,
        "src/components/workspace/settings/config-settings-page.tsx",
      ),
      "utf8",
    );

    expect(settings).toContain("QiongqiConfigSchema");
    expect(settings).toContain("models.profiles");
    expect(settings).toContain("添加 Profile");
    expect(settings).toContain("删除 Profile");
    expect(settings).toContain("contextCompaction");
    expect(settings).toContain("serve.storage");
    expect(settings).toContain("serve.observability");
    expect(settings).toContain("capabilities.mcp");
    expect(settings).toContain("MCP 工具管理");
    expect(settings).toContain("/workspace/mcp");
    expect(settings).toContain("MCP 运行时");
    expect(settings).toContain("capabilities.web");
    expect(settings).toContain("内置 Web 工具");
    expect(settings).toContain("web_fetch");
    expect(settings).toContain("web_search");
    expect(settings).toContain("查看 MCP Web 工具");
    expect(settings).toContain("MCP 工具的域名策略");
    expect(settings).toContain("capabilities.skills");
    expect(settings).toContain("capabilities.subagents");
    expect(settings).not.toContain("capabilities.attachments");
    expect(settings).toContain("saveConfigSection");
    expect(settings).toContain("useQueryClient");
    expect(settings).toContain('queryKey: ["models"]');
    expect(settings).toContain("onWriteStatusChange");
    expect(settings).toContain("配置已生效");
    expect(settings).toContain("配置写入中");
    expect(settings).toContain("保存当前分组");
    expect(settings).toContain("放弃修改");
    expect(settings).toContain("saveCurrentSection");
    expect(settings).toContain("updateConfigDraft");
    expect(settings).toContain('kind: "success"');
    expect(settings).toContain('kind: "error"');
    expect(settings).not.toContain("toast.error");
    expect(settings).not.toContain("void saveSection(section, next)");
    expect(settings).not.toContain("applyConfigChange");
    expect(settings).not.toContain("服务与模型入口");
    expect(settings).not.toContain("运行时调优");
    expect(settings).not.toContain("设为运行时核心");
    expect(settings).not.toContain("当前运行时核心模型");
    expect(settings).not.toContain("runtime core");
    expect(settings).not.toContain("activateCurrentProfile");
    expect(settings).not.toContain("应用并重启");
    expect(settings).not.toContain("handleApplyAndRestart");
    expect(settings).not.toContain("restartGateway");
    expect(settings).not.toContain("waitForGateway");
    expect(settings).not.toContain("restartBackend");
    expect(settings).not.toContain("PowerIcon");
    expect(settings).not.toContain('id: "serve"');
    expect(settings).not.toContain('label: "运行时调优"');
    expect(settings).not.toContain('case "serve"');
    expect(settings).not.toContain('case "runtime"');
    expect(settings).not.toContain("Coding Agent");
    expect(settings).not.toContain("YAML 编辑器");
    expect(settings).not.toContain("数据库");
  });

  test("removes unreachable empty-result workspace surfaces", () => {
    const removedPaths = [
      "src/app/workspace/agents",
      "src/components/workspace/agents",
      "src/core/agents",
      "src/app/workspace/channels",
      "src/components/workspace/channels",
      "src/core/channels",
      "src/components/workspace/settings/memory-settings-page.tsx",
      "src/core/memory",
      "src/core/api/feedback.ts",
    ];

    for (const removedPath of removedPaths) {
      expect(existsSync(resolve(repoRoot, removedPath))).toBe(false);
    }
  });

  test("chat input no longer calls the legacy empty follow-up suggestions API", () => {
    const inputBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/input-box.tsx"),
      "utf8",
    );
    const chatPage = readFileSync(
      resolve(repoRoot, "src/app/workspace/chats/[thread_id]/page.tsx"),
      "utf8",
    );
    const messageList = readFileSync(
      resolve(repoRoot, "src/components/workspace/messages/message-list.tsx"),
      "utf8",
    );

    expect(inputBox).not.toContain("/api/threads/${threadId}/suggestions");
    expect(inputBox).not.toContain("setFollowupsLoading");
    expect(inputBox).not.toContain("useFollowupsContext");
    expect(chatPage).not.toContain("FollowupsProvider");
    expect(messageList).not.toContain("FollowupPanel");
  });

  test("message items do not expose synthetic legacy run feedback controls", () => {
    const item = readFileSync(
      resolve(
        repoRoot,
        "src/components/workspace/messages/message-list-item.tsx",
      ),
      "utf8",
    );

    expect(item).not.toContain("@/core/api/feedback");
    expect(item).not.toContain("FeedbackButtons");
    expect(item).not.toContain("ThumbsUpIcon");
    expect(item).not.toContain("ThumbsDownIcon");
  });
});
