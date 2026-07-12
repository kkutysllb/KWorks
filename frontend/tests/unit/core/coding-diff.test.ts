import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("coding diff workflow", () => {
  test("project core exposes diff types, API, and query hook", () => {
    const types = readFileSync(
      resolve(repoRoot, "src/core/projects/types.ts"),
      "utf8",
    );
    const api = readFileSync(
      resolve(repoRoot, "src/core/projects/api.ts"),
      "utf8",
    );
    const hooks = readFileSync(
      resolve(repoRoot, "src/core/projects/hooks.ts"),
      "utf8",
    );

    expect(types).toContain("export interface ProjectDiffFile");
    expect(types).toContain("diff?: string");
    expect(types).toContain("export interface ProjectDiff");
    expect(api).toContain("export async function getProjectDiff");
    expect(api).toContain("export async function discardProjectFileChange");
    expect(api).toContain("/diff");
    expect(api).toContain("/diff/discard");
    expect(hooks).toContain("export function useProjectDiff");
    expect(hooks).toContain("export function useDiscardProjectFileChange");
    expect(hooks).toContain('queryKey: ["projects", projectId, "diff"]');
  });

  test("coding workbench renders the merged changes tab in the right pane", () => {
    const workbench = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/coding-workbench.tsx"),
      "utf8",
    );

    expect(workbench).toContain("CodingDiffPanel");
    expect(workbench).toContain("CodingTaskChangesPanel");
    // The former "diff" and "task-changes" tabs merged into a single "changes"
    // tab that stacks both panels.
    expect(workbench).toContain('workbenchView === "changes"');
    expect(workbench).toContain("showWorkbenchPane &&");
    expect(workbench).toContain("<CodeViewer");
    expect(workbench).toContain('aria-label="代码区视图"');
    expect(workbench).toContain('handleSelectWorkbenchTab("changes")');
    expect(workbench).toContain("activeCodeTab === \"changes\"");
    expect(workbench).toContain('label="变更"');
    // The old separate diff/task-changes tabs are gone.
    expect(workbench).not.toContain('handleSelectWorkbenchTab("diff")');
    expect(workbench).not.toContain('handleSelectWorkbenchTab("task-changes")');
    expect(workbench).not.toContain('workbenchView === "diff"');
  });

  test("coding diff panel shows changed files and an inline unified diff", () => {
    const panel = readFileSync(
      resolve(
        repoRoot,
        "src/components/workspace/coding/coding-diff-panel.tsx",
      ),
      "utf8",
    );

    expect(panel).toContain("useProjectDiff");
    expect(panel).toContain("selectedDiffFile");
    expect(panel).toContain("filteredDiff");
    expect(panel).toContain("selectedFile?.diff");
    expect(panel).toContain("selectedFilePath");
    expect(panel).toContain("focusLine");
    expect(panel).toContain("focusedDiffLine");
    expect(panel).toContain("totalAdditions");
    expect(panel).toContain("totalDeletions");
    expect(panel).toContain("refetch");
    expect(panel).toContain("RefreshCwIcon");
    expect(panel).toContain("Undo2Icon");
    expect(panel).toContain("discardProjectFileChange");
    expect(panel).toContain("撤销此文件");
    expect(panel).toContain("确认撤销");
    expect(panel).toContain("renderUnifiedDiff");
    expect(panel).toContain("highlightedUnifiedLine");
    expect(panel).toContain("diffScope");
    expect(panel).toContain('"selected"');
    expect(panel).toContain('"all"');
    expect(panel).toContain("overflow-x-auto");
    expect(panel).toContain(
      "inline-flex h-8 shrink-0 items-center rounded-md p-1",
    );
    expect(panel).toContain("当前文件暂无变更");
    expect(panel).toContain("isFetching");
    expect(panel).toContain("正在刷新变更");
    expect(panel).toContain("当前项目不是 Git 仓库");
    expect(panel).toContain("新增");
    expect(panel).toContain("删除");
    expect(panel).toContain("修改");
    expect(panel).toContain(
      "files.some((file) => file.path === selectedDiffFile)",
    );

    // The split-view mode was removed: only the unified renderer remains.
    expect(panel).not.toContain("diffViewMode");
    expect(panel).not.toContain('"side-by-side"');
    expect(panel).not.toContain("SideBySideDiff");
    expect(panel).not.toContain("parseUnifiedDiffForSideBySide");
    expect(panel).not.toContain("左右对比");
    // The shared side-by-side module was deleted entirely.
    expect(
      existsSync(
        resolve(repoRoot, "src/components/workspace/coding/diff-view.tsx"),
      ),
    ).toBe(false);
  });

  test("coding agent refreshes diff state after file activity", () => {
    const agentPanel = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/agent-panel.tsx"),
      "utf8",
    );

    expect(agentPanel).toContain('queryKey: ["projects", projectId, "diff"]');
  });
});
