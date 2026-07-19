# Coding Diff List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Coding change panel's two-column file/detail layout with a single-column list whose selected file expands its diff inline.

**Architecture:** Keep `CodingDiffPanel` as the owner of query, selection, diff scope, discard, truncation, and line-focus state. Replace only the returned layout: each file row is a native button and the selected row renders a detail block directly below it. Existing diff filtering and `renderUnifiedDiff` remain unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest source-contract tests, Next static desktop export.

---

### Task 1: Add the failing layout contract

**Files:**
- Modify: `frontend/tests/unit/core/coding-diff.test.ts`

- [ ] **Step 1: Add assertions for the requested list structure**

Keep the existing behavior assertions and add checks that the panel source contains:

```ts
expect(panel).toContain('aria-expanded={selectedDiffFile === file.path}');
expect(panel).toContain('data-testid={`coding-diff-file-${file.path}`}');
expect(panel).toContain('selectedDiffFile === file.path && (');
expect(panel).not.toContain('className="w-72 shrink-0 border-r"');
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd frontend
pnpm exec vitest run tests/unit/core/coding-diff.test.ts
```

Expected: FAIL because the current source still has the split `w-72` file-list container and does not expose inline expansion markers.

### Task 2: Implement the single-column inline list

**Files:**
- Modify: `frontend/src/components/workspace/coding/coding-diff-panel.tsx`

- [ ] **Step 1: Replace the split body with a full-width list**

Keep the existing loading/error/empty branches, header, state calculations, diff filtering, and discard handler. Replace the `<div className="flex min-h-0 flex-1">` body with:

```tsx
<ScrollArea className="min-h-0 flex-1">
  <div className="space-y-2 p-2">
    {selectedWorkspaceFileHasNoDiff && (
      <div className="text-muted-foreground border-b px-2 py-2 text-xs">
        当前文件暂无变更，已显示项目中的其他变更。
      </div>
    )}
    {files.map((file) => {
      const isSelected = selectedDiffFile === file.path;
      return (
        <article
          key={file.path}
          data-testid={`coding-diff-file-${file.path}`}
          className={cn(
            "overflow-hidden rounded-md border",
            isSelected && "border-emerald-500/40",
          )}
        >
          <button
            aria-expanded={isSelected}
            className={cn(
              "hover:bg-muted/60 flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm",
              isSelected && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            )}
            type="button"
            onClick={() => setSelectedDiffFile(file.path)}
          >
            <StatusBadge status={file.status} />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-xs">
              <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>{" "}
              <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
            </span>
          </button>
          {isSelected && (
            <div className="border-t">
              <div className="flex min-h-10 flex-wrap items-center gap-2 border-b px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{file.path}</span>
                {diffScope === "selected" && (
                  <div className="bg-muted text-muted-foreground inline-flex h-8 shrink-0 items-center rounded-md p-1">
                    <Button className="h-6 px-2 text-xs" size="sm" type="button" variant={diffScope === "selected" ? "secondary" : "ghost"} onClick={() => setDiffScope("selected")}>当前文件</Button>
                    <Button className="h-6 px-2 text-xs" size="sm" type="button" variant={diffScope === "all" ? "secondary" : "ghost"} onClick={() => setDiffScope("all")}>全部变更</Button>
                  </div>
                )}
                <Button className="h-7 px-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400" disabled={discardProjectFileChange.isPending} size="sm" title="撤销此文件的未提交变更" type="button" variant="ghost" onClick={handleDiscardSelectedFile}><Undo2Icon className="mr-1 h-3 w-3" />{discardProjectFileChange.isPending ? "撤销中" : "撤销此文件"}</Button>
              </div>
              {discardError && <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-700 dark:text-red-300">{discardError}</div>}
              {isDiffTruncated && <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"><AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" /><span>Diff 过大（{diffLines.length.toLocaleString()} 行），为避免渲染崩溃仅显示前 {MAX_DIFF_RENDER_LINES.toLocaleString()} 行。</span></div>}
              <div className="overflow-x-auto">
                {renderUnifiedDiff(displayDiffText, focusedDiffLine)}
              </div>
            </div>
          )}
        </article>
      );
    })}
  </div>
</ScrollArea>
```

Use the existing button variants, labels, discard mutation, notices, and
`renderUnifiedDiff` call; do not introduce a second diff renderer or change
the query/state behavior.

- [ ] **Step 2: Run the focused layout test**

Run:

```bash
cd frontend
pnpm exec vitest run tests/unit/core/coding-diff.test.ts
```

Expected: PASS with the existing behavior assertions and the new single-column assertions.

### Task 3: Verify the frontend and desktop artifact

**Files:**
- No additional source changes expected.

- [ ] **Step 1: Run all frontend tests and type checking**

```bash
cd frontend
pnpm test
pnpm typecheck
pnpm exec eslint --no-ignore src/components/workspace/coding/coding-diff-panel.tsx tests/unit/core/coding-diff.test.ts --ext .ts,.tsx
```

Expected: all tests and type checking pass; targeted lint has no errors.

- [ ] **Step 2: Build the static desktop frontend**

Stop any running Next dev server first, then run:

```bash
cd frontend
pnpm run build:desktop
```

Expected: `Static export complete.`

- [ ] **Step 3: Inspect the final diff and commit**

```bash
cd /Users/libing/kk_Projects/KWorks
git diff --check
git status --short
git add frontend/src/components/workspace/coding/coding-diff-panel.tsx frontend/tests/unit/core/coding-diff.test.ts
git commit -m "fix: show coding changes as an inline list"
```

Expected: only the panel and its focused test are committed.
