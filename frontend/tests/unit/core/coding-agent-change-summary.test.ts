import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("coding agent change summary card", () => {
  test("agent panel renders clickable changed files below the chat stream", () => {
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

    expect(agentPanel).toContain("useCodingSessionChanges");
    expect(agentPanel).toContain("useDiscardProjectFileChange");
    expect(agentPanel).toContain("CodingChangeSummaryCard");
    expect(agentPanel).toContain("已编辑");
    expect(agentPanel).toContain("审查");
    expect(agentPanel).toContain("撤销");
    expect(agentPanel).toContain("撤销变更");
    expect(agentPanel).toContain("全部撤销");
    expect(agentPanel).toContain("只撤销选中文件");
    expect(agentPanel).toContain("changedFiles");
    expect(agentPanel).toContain("latestTaskId");
    expect(agentPanel).toContain("visibleFiles");
    expect(agentPanel).toContain("setExpanded((value) => !value)");
    expect(agentPanel).toContain("{expanded && (");
    expect(agentPanel).toContain("slice(0, 4)");
    expect(agentPanel).toContain("max-h-[172px]");
    expect(agentPanel).toContain("更多");
    expect(agentPanel).toContain("max-w-3xl");
    expect(agentPanel).toContain("handleReviewChanges");
    expect(agentPanel).toContain("handleDiscardChanges");
    expect(agentPanel).toContain("Promise.all");
    expect(agentPanel).toContain("relative flex w-full max-w-4xl min-w-0 flex-col");
    expect(agentPanel).toContain('<div\n                    className="w-full min-w-0"');
    expect(agentPanel).toContain("min-h-32 w-full");
    expect(agentPanel).toContain("[&_[data-slot=input-group]]:min-h-32");
    expect(agentPanel).toContain(
      "[&_[data-slot=input-group-control]]:min-h-20",
    );
    expect(agentPanel).not.toContain("bottom-[104px]");
    expect(agentPanel).not.toContain("bottom-24");
    expect(agentPanel).toContain(
      'onFocusFile?.(file.path, "task-changes", file.taskId)',
    );
    expect(agentPanel).toContain("handleOpenMessageFileChange");
    expect(agentPanel).toContain("onOpenFileChange=");
    expect(agentPanel).toContain(
      "MESSAGE_LIST_CODING_CHANGES_EXTRA_PADDING_BOTTOM",
    );
    expect(agentPanel).toContain("onFocusFile={onFocusFile}");
    expect(messageList).toContain("onOpenFileChange?: MessageFileFocusHandler");
    expect(messageList).toContain("onOpenFileChange={onOpenFileChange}");
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
