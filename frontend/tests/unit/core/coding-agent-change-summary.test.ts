import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("coding agent change summary card", () => {
  test("agent panel no longer embeds the in-stream change summary card", () => {
    const agentPanel = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/agent-panel.tsx"),
      "utf8",
    );
    const workbench = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/coding-workbench.tsx"),
      "utf8",
    );
    const messageList = readFileSync(
      resolve(repoRoot, "src/components/workspace/messages/message-list.tsx"),
      "utf8",
    );
    const messageGroup = readFileSync(
      resolve(repoRoot, "src/components/workspace/messages/message-group.tsx"),
      "utf8",
    );

    // The inline change-summary card was removed from the agent panel; change
    // review now lives exclusively in the merged right-pane "变更" tab.
    expect(agentPanel).not.toContain("CodingChangeSummaryCard");
    expect(agentPanel).not.toContain("已编辑");
    expect(agentPanel).not.toContain("审查");
    expect(agentPanel).not.toContain("撤销变更");
    expect(agentPanel).not.toContain("全部撤销");
    expect(agentPanel).not.toContain("useDiscardProjectFileChange");
    expect(agentPanel).not.toContain("changedFiles");
    expect(agentPanel).not.toContain("latestTaskId");
    expect(agentPanel).not.toContain("visibleFiles");
    expect(agentPanel).not.toContain("max-h-[172px]");
    expect(agentPanel).not.toContain("handleReviewChanges");
    expect(agentPanel).not.toContain("handleDiscardChanges");
    expect(agentPanel).not.toContain(
      "MESSAGE_LIST_CODING_CHANGES_EXTRA_PADDING_BOTTOM",
    );
    expect(agentPanel).not.toContain('hasCodingChanges ? "bottom-60"');
    expect(agentPanel).not.toContain("useCodingSessionChanges");
    // The deduplicated change summary also no longer reaches the environment
    // floating card.
    expect(workbench).not.toContain("additions={totalAdditions}");
    expect(workbench).not.toContain("deletions={totalDeletions}");
    expect(workbench).not.toContain("changedFiles={totalChangedFiles}");

    // The agent panel still owns its chat layout + message wiring.
    expect(agentPanel).toContain("CODING_AGENT_CONTENT_WIDTH_CLASS");
    expect(agentPanel).toContain(
      "contentClassName={CODING_AGENT_CONTENT_WIDTH_CLASS}",
    );
    expect(agentPanel).toContain("CODING_AGENT_FLOATING_PANEL_GUTTER_CLASS");
    expect(agentPanel).toContain("xl:pr-[356px]");
    expect(agentPanel).toContain(
      "avoidRightFloatingPanels &&\n                    CODING_AGENT_FLOATING_PANEL_GUTTER_CLASS",
    );
    expect(agentPanel).toContain(
      "relative flex w-full min-w-0 flex-col items-center",
    );
    expect(agentPanel).toContain("min-h-28 w-full");
    expect(agentPanel).toContain("[&_[data-slot=input-group]]:min-h-28");
    expect(agentPanel).toContain(
      "[&_[data-slot=input-group-control]]:min-h-16",
    );
    expect(agentPanel).toContain("data-floating-panels");
    expect(agentPanel).toContain("paddingBottom={MESSAGE_LIST_DEFAULT_PADDING_BOTTOM}");
    expect(agentPanel).toContain("handleOpenMessageFileChange");
    expect(agentPanel).toContain("onOpenFileChange=");
    expect(agentPanel).toContain('onFocusFile?.(filePath, "code")');
    expect(agentPanel).toContain("onFocusFile={onFocusFile}");

    expect(messageList).toContain("onOpenFileChange?: MessageFileFocusHandler");
    expect(messageList).toContain("onOpenFileChange={onOpenFileChange}");
    expect(messageList).toContain(
      'contentClassName ?? "max-w-(--container-width-md)"',
    );
    expect(messageGroup).toContain("MessageFileFocusHandler");
    expect(messageGroup).toContain('return "task-changes"');
    expect(messageGroup).toContain('return "code"');
    expect(messageGroup).toContain("hover:underline");
    expect(workbench).toContain("onFocusFile={focusWorkbenchFile}");
    expect(workbench).toContain("<AgentPanel");
    expect(workbench).toContain(
      "normalizeProjectFilePath(filePath, project.path)",
    );
    expect(workbench).toContain("normalizeProjectFilePath");
  });
});
