# Finance Fullscreen Artifact Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make finance HTML result files render as an isolated, full-viewport in-app dashboard with a back action and automatic companion Markdown download.

**Architecture:** Keep the existing `ChatBox` artifact collection and selection flow, then observe that shared state from a finance-only bridge rendered inside the current thread provider. A dedicated finance reader loads the selected HTML into a sandboxed blob iframe, resolves the best Markdown companion with a pure helper, and portals a fixed layer over the workspace. The packaged desktop CSP adds only the two script origins required by existing finance dashboards.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Vitest with happy-dom, Electron 33, Node test runner.

---

## File Map

- Create `frontend/src/components/workspace/finance/finance-artifact-files.ts`: pure path normalization and companion Markdown selection.
- Create `frontend/src/components/workspace/finance/finance-artifact-preview.tsx`: full-viewport finance dashboard reader, state handling, blob lifecycle, back/download actions.
- Modify `frontend/src/components/workspace/finance/finance-agent-panel.tsx`: connect shared artifact selection state to the finance reader without changing office mode.
- Modify `frontend/src/core/artifacts/hooks.ts`: expose TanStack Query's `refetch` for the reader error state.
- Create `frontend/tests/unit/core/finance-artifact-files.test.ts`: deterministic matching tests, including the real dashboard filename set.
- Create `frontend/tests/unit/components/workspace/finance-artifact-preview.test.tsx`: reader rendering and interaction tests.
- Create `frontend/tests/unit/core/finance-artifact-layout.test.ts`: finance-only integration and office-mode regression assertions.
- Modify `desktop/src/main.ts`: add exact Tailwind CDN and jsDelivr origins to packaged HTML `script-src`.
- Modify `desktop/tests/window-security.test.mjs`: assert the allowlist and continued denial of broad HTTPS scripts and `unsafe-eval`.

## Working Tree Guardrail

The workspace already contains unrelated or user-owned changes in:

- `frontend/src/components/workspace/coding/diff-view.tsx`
- `frontend/src/components/workspace/finance/finance-agent-panel.tsx`
- `qiongqi/tests/work-mode-api.test.ts`

Before every commit, run `git diff --cached --name-status`. Stage only the files named by the current task. Preserve the existing finance panel edits and integrate around them; never restore or overwrite unrelated changes.

### Task 1: Companion Markdown Resolution

**Files:**
- Create: `frontend/src/components/workspace/finance/finance-artifact-files.ts`
- Test: `frontend/tests/unit/core/finance-artifact-files.test.ts`

- [ ] **Step 1: Write the failing matching tests**

Create `frontend/tests/unit/core/finance-artifact-files.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { resolveFinanceMarkdownArtifact } from "@/components/workspace/finance/finance-artifact-files";

describe("resolveFinanceMarkdownArtifact", () => {
  test("prefers a same-directory Markdown file with the same stem", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/weekly.html", [
        "reports/analysis_report.md",
        "reports/weekly.md",
      ]),
    ).toBe("reports/weekly.md");
  });

  test("selects the semantic report from the representative dashboard set", () => {
    const root = "reports/2026-07-10_market_linkage";
    expect(
      resolveFinanceMarkdownArtifact(`${root}/dashboard.html`, [
        `${root}/daily_report.md`,
        `${root}/AUDIT.md`,
        `${root}/one_liner.md`,
        `${root}/dashboard.html`,
      ]),
    ).toBe(`${root}/daily_report.md`);
  });

  test("uses the latest eligible same-directory Markdown artifact", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "reports/notes.md",
        "reports/summary.md",
      ]),
    ).toBe("reports/summary.md");
  });

  test("falls back to the latest eligible task Markdown artifact", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "other/earlier.md",
        "other/latest.md",
      ]),
    ).toBe("other/latest.md");
  });

  test("normalizes Windows separators without changing the returned path", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports\\dashboard.html", [
        "reports\\dashboard.md",
      ]),
    ).toBe("reports\\dashboard.md");
  });

  test("uses an auxiliary Markdown only when no normal report exists", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "reports/AUDIT.md",
        "reports/one_liner.md",
      ]),
    ).toBe("reports/one_liner.md");
  });

  test("returns undefined when the task has no Markdown artifact", () => {
    expect(
      resolveFinanceMarkdownArtifact("reports/dashboard.html", [
        "reports/dashboard.html",
        "reports/daily.json",
      ]),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run:

```bash
cd frontend
pnpm test -- tests/unit/core/finance-artifact-files.test.ts
```

Expected: FAIL because `finance-artifact-files` does not exist.

- [ ] **Step 3: Implement the pure resolver**

Create `frontend/src/components/workspace/finance/finance-artifact-files.ts`:

```ts
const AUXILIARY_MARKDOWN_NAMES = [
  "audit",
  "one_liner",
  "one-liner",
  "readme",
  "审计",
  "一句话",
];

const REPORT_NAME_HINTS = ["report", "analysis", "报告", "分析"];

interface ArtifactPathParts {
  basename: string;
  directory: string;
  extension: string;
  stem: string;
}

function pathParts(path: string): ArtifactPathParts {
  const normalized = path.replaceAll("\\", "/");
  const slashIndex = normalized.lastIndexOf("/");
  const basename = normalized.slice(slashIndex + 1);
  const dotIndex = basename.lastIndexOf(".");
  return {
    basename,
    directory: slashIndex >= 0 ? normalized.slice(0, slashIndex) : "",
    extension: dotIndex >= 0 ? basename.slice(dotIndex).toLowerCase() : "",
    stem: (dotIndex >= 0 ? basename.slice(0, dotIndex) : basename).toLowerCase(),
  };
}

function pickLast(paths: readonly string[]): string | undefined {
  return paths.length > 0 ? paths[paths.length - 1] : undefined;
}

function isAuxiliaryMarkdown(path: string): boolean {
  const basename = pathParts(path).basename.toLowerCase();
  return AUXILIARY_MARKDOWN_NAMES.some((name) => basename.includes(name));
}

export function isHtmlArtifact(path: string): boolean {
  return pathParts(path).extension === ".html";
}

export function resolveFinanceMarkdownArtifact(
  htmlPath: string,
  artifacts: readonly string[],
): string | undefined {
  const html = pathParts(htmlPath);
  const markdownPaths = artifacts.filter(
    (path) => pathParts(path).extension === ".md",
  );
  if (markdownPaths.length === 0) return undefined;

  const normalPaths = markdownPaths.filter((path) => !isAuxiliaryMarkdown(path));
  const candidates = normalPaths.length > 0 ? normalPaths : markdownPaths;
  const sameDirectory = candidates.filter(
    (path) => pathParts(path).directory === html.directory,
  );

  const sameStem = sameDirectory.filter(
    (path) => pathParts(path).stem === html.stem,
  );
  if (sameStem.length > 0) return pickLast(sameStem);

  const semanticReport = sameDirectory.filter((path) => {
    const basename = pathParts(path).basename.toLowerCase();
    return REPORT_NAME_HINTS.some((hint) => basename.includes(hint));
  });

  return (
    pickLast(semanticReport) ??
    pickLast(sameDirectory) ??
    pickLast(candidates)
  );
}
```

- [ ] **Step 4: Run the resolver tests**

Run:

```bash
cd frontend
pnpm test -- tests/unit/core/finance-artifact-files.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit only the resolver and its test**

```bash
git add frontend/src/components/workspace/finance/finance-artifact-files.ts frontend/tests/unit/core/finance-artifact-files.test.ts
git diff --cached --name-status
git commit -m "feat(finance): resolve dashboard markdown reports"
```

### Task 2: Full-Viewport Finance Reader

**Files:**
- Create: `frontend/src/components/workspace/finance/finance-artifact-preview.tsx`
- Modify: `frontend/src/core/artifacts/hooks.ts`
- Test: `frontend/tests/unit/components/workspace/finance-artifact-preview.test.tsx`

- [ ] **Step 1: Write failing reader interaction tests**

Create `frontend/tests/unit/components/workspace/finance-artifact-preview.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";

const artifactContentMock = vi.hoisted(() => vi.fn());
const downloadMock = vi.hoisted(() => vi.fn());

vi.mock("@/core/artifacts/hooks", () => ({
  useArtifactContent: artifactContentMock,
}));

vi.mock("@/core/artifacts/authenticated-url", () => ({
  downloadArtifactUrl: downloadMock,
}));

vi.mock("@/core/artifacts/utils", () => ({
  urlOfArtifact: ({ filepath, download }: { filepath: string; download?: boolean }) =>
    `/artifact?path=${encodeURIComponent(filepath)}${download ? "&download=true" : ""}`,
}));

import { FinanceArtifactPreview } from "@/components/workspace/finance/finance-artifact-preview";

describe("FinanceArtifactPreview", () => {
  beforeEach(() => {
    artifactContentMock.mockReturnValue({
      content: "<!doctype html><html><body>Finance dashboard</body></html>",
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    downloadMock.mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:finance-dashboard"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  test("renders a full viewport sandboxed iframe and returns to the task", async () => {
    const onBack = vi.fn();
    render(
      <FinanceArtifactPreview
        artifacts={["reports/daily_report.md", "reports/dashboard.html"]}
        filepath="reports/dashboard.html"
        threadId="thread-1"
        onBack={onBack}
      />,
    );

    const iframe = await screen.findByTitle("dashboard.html 金融看板");
    expect(screen.getByTestId("finance-artifact-preview")).toHaveClass(
      "fixed",
      "inset-0",
    );
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-forms");
    expect(iframe).toHaveAttribute("src", "blob:finance-dashboard");

    fireEvent.click(screen.getByRole("button", { name: "返回任务" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  test("downloads the resolved Markdown report", async () => {
    render(
      <FinanceArtifactPreview
        artifacts={[
          "reports/daily_report.md",
          "reports/AUDIT.md",
          "reports/dashboard.html",
        ]}
        filepath="reports/dashboard.html"
        threadId="thread-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "下载 MD 报告" }));
    await waitFor(() => {
      expect(downloadMock).toHaveBeenCalledWith(
        "/artifact?path=reports%2Fdaily_report.md&download=true",
        "daily_report.md",
      );
    });
  });

  test("disables Markdown download when no report exists", () => {
    render(
      <FinanceArtifactPreview
        artifacts={["reports/dashboard.html"]}
        filepath="reports/dashboard.html"
        threadId="thread-1"
        onBack={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "下载 MD 报告" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "未找到 Markdown 报告");
  });

  test("shows load and fetch error states", () => {
    artifactContentMock.mockReturnValueOnce({
      content: undefined,
      error: null,
      isLoading: true,
      refetch: vi.fn(),
    });
    const { rerender } = render(
      <FinanceArtifactPreview
        artifacts={["reports/dashboard.html"]}
        filepath="reports/dashboard.html"
        threadId="thread-1"
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("正在加载金融看板...")).toBeInTheDocument();

    artifactContentMock.mockReturnValue({
      content: undefined,
      error: new Error("403 Forbidden"),
      isLoading: false,
      refetch: vi.fn(),
    });
    rerender(
      <FinanceArtifactPreview
        artifacts={["reports/dashboard.html"]}
        filepath="reports/dashboard.html"
        threadId="thread-1"
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("金融看板加载失败")).toBeInTheDocument();
    expect(screen.getByText("403 Forbidden")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "下载 HTML" }));
    expect(downloadMock).toHaveBeenCalledWith(
      "/artifact?path=reports%2Fdashboard.html&download=true",
      "dashboard.html",
    );
  });
});
```

- [ ] **Step 2: Run the test and verify the missing component failure**

```bash
cd frontend
pnpm test -- tests/unit/components/workspace/finance-artifact-preview.test.tsx
```

Expected: FAIL because `FinanceArtifactPreview` does not exist.

- [ ] **Step 3: Expose query refetch from the artifact hook**

In `frontend/src/core/artifacts/hooks.ts`, change the query destructuring and return value:

```ts
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["artifact", filepath, threadId, isMock],
    queryFn: () => loadArtifactContent({ filepath, threadId, isMock }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return {
    content: isWriteFile ? content : data?.content,
    url: isWriteFile ? undefined : data?.url,
    isLoading,
    error,
    refetch,
  };
```

- [ ] **Step 4: Implement the full-viewport reader**

Create `frontend/src/components/workspace/finance/finance-artifact-preview.tsx` with these complete behaviors:

```tsx
"use client";

import { ArrowLeftIcon, DownloadIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadArtifactUrl } from "@/core/artifacts/authenticated-url";
import { useArtifactContent } from "@/core/artifacts/hooks";
import { urlOfArtifact } from "@/core/artifacts/utils";

import { resolveFinanceMarkdownArtifact } from "./finance-artifact-files";

interface FinanceArtifactPreviewProps {
  artifacts: readonly string[];
  filepath: string;
  onBack: () => void;
  threadId: string;
}

function basename(path: string): string {
  return path.replaceAll("\\", "/").split("/").pop() || path;
}

export function FinanceArtifactPreview({
  artifacts,
  filepath,
  onBack,
  threadId,
}: FinanceArtifactPreviewProps) {
  const { content, error, isLoading, refetch } = useArtifactContent({
    enabled: true,
    filepath,
    threadId,
  });
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [isDownloading, setIsDownloading] = useState(false);
  const markdownPath = useMemo(
    () => resolveFinanceMarkdownArtifact(filepath, artifacts),
    [artifacts, filepath],
  );

  useEffect(() => {
    if (!content) {
      setPreviewUrl(undefined);
      return undefined;
    }
    const nextUrl = URL.createObjectURL(
      new Blob([content], { type: "text/html;charset=utf-8" }),
    );
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [content]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  const handleMarkdownDownload = useCallback(async () => {
    if (!markdownPath || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadArtifactUrl(
        urlOfArtifact({
          download: true,
          filepath: markdownPath,
          threadId,
        }),
        basename(markdownPath),
      );
    } catch (downloadError) {
      console.error("Failed to download finance Markdown report:", downloadError);
      toast.error("Markdown 报告下载失败");
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, markdownPath, threadId]);

  const handleHtmlDownload = useCallback(async () => {
    try {
      await downloadArtifactUrl(
        urlOfArtifact({ download: true, filepath, threadId }),
        basename(filepath),
      );
    } catch (downloadError) {
      console.error("Failed to download finance HTML dashboard:", downloadError);
      toast.error("HTML 看板下载失败");
    }
  }, [filepath, threadId]);

  const reader = (
    <section
      aria-label="金融结果预览"
      className="bg-background fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden"
      data-testid="finance-artifact-preview"
    >
      <header className="flex h-11 shrink-0 items-center border-b border-white/10 bg-neutral-950 px-2 text-neutral-100 sm:px-3">
        <Button
          aria-label="返回任务"
          className="h-8 gap-1.5 text-neutral-200 hover:bg-white/10 hover:text-white"
          onClick={onBack}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeftIcon className="size-4 text-emerald-400" />
          <span className="hidden sm:inline">返回任务</span>
        </Button>
        <p className="min-w-0 flex-1 truncate px-3 text-center text-xs text-neutral-400">
          {basename(filepath)}
        </p>
        <Button
          aria-label="下载 MD 报告"
          className="h-8 gap-1.5 border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800"
          disabled={!markdownPath || isDownloading}
          onClick={() => void handleMarkdownDownload()}
          size="sm"
          title={markdownPath ? "下载 Markdown 报告" : "未找到 Markdown 报告"}
          type="button"
          variant="outline"
        >
          {isDownloading ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <DownloadIcon className="size-4" />
          )}
          <span className="hidden sm:inline">MD 报告</span>
        </Button>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden bg-white">
        {isLoading ? (
          <div className="flex size-full items-center justify-center gap-2 text-sm text-neutral-600">
            <LoaderCircleIcon className="size-5 animate-spin text-emerald-600" />
            正在加载金融看板...
          </div>
        ) : error ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center text-neutral-700">
            <p className="font-medium text-neutral-950">金融看板加载失败</p>
            <p className="max-w-xl text-xs [overflow-wrap:anywhere]">
              {error.message}
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={() => void refetch()} size="sm" variant="outline">
                <RefreshCwIcon className="size-4" />
                重试
              </Button>
              <Button
                aria-label="下载 HTML"
                onClick={() => void handleHtmlDownload()}
                size="sm"
                variant="outline"
              >
                <DownloadIcon className="size-4" />
                下载 HTML
              </Button>
            </div>
          </div>
        ) : !content || !previewUrl ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 text-sm text-neutral-600">
            <p>文件内容为空</p>
            <Button
              aria-label="下载 HTML"
              onClick={() => void handleHtmlDownload()}
              size="sm"
              variant="outline"
            >
              <DownloadIcon className="size-4" />
              下载 HTML
            </Button>
          </div>
        ) : (
          <iframe
            className="size-full border-0"
            sandbox="allow-scripts allow-forms"
            src={previewUrl}
            title={`${basename(filepath)} 金融看板`}
          />
        )}
      </main>
    </section>
  );

  return createPortal(reader, document.body);
}
```

- [ ] **Step 5: Run and fix the focused reader tests**

```bash
cd frontend
pnpm test -- tests/unit/components/workspace/finance-artifact-preview.test.tsx tests/unit/core/finance-artifact-files.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 6: Commit the reader slice**

```bash
git add frontend/src/components/workspace/finance/finance-artifact-preview.tsx frontend/src/core/artifacts/hooks.ts frontend/tests/unit/components/workspace/finance-artifact-preview.test.tsx
git diff --cached --name-status
git commit -m "feat(finance): add fullscreen dashboard reader"
```

### Task 3: Finance-Only Artifact Integration

**Files:**
- Modify: `frontend/src/components/workspace/finance/finance-agent-panel.tsx`
- Create: `frontend/tests/unit/core/finance-artifact-layout.test.ts`

- [ ] **Step 1: Write failing finance/office integration assertions**

Create `frontend/tests/unit/core/finance-artifact-layout.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("finance artifact presentation", () => {
  test("finance HTML selection opens the dedicated full viewport reader", () => {
    const panel = readFileSync(
      resolve(repoRoot, "src/components/workspace/finance/finance-agent-panel.tsx"),
      "utf8",
    );

    expect(panel).toContain("FinanceHtmlArtifactReader");
    expect(panel).toContain("isHtmlArtifact(selectedArtifact)");
    expect(panel).toContain("<FinanceArtifactPreview");
    expect(panel).toContain("onBack={deselect}");
  });

  test("office chat keeps the existing generic side panel", () => {
    const chatBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/chats/chat-box.tsx"),
      "utf8",
    );

    expect(chatBox).toContain('artifactsMode = "side-panel"');
    expect(chatBox).toContain("<ResizablePanelGroup");
    expect(chatBox).toContain("<ArtifactFileDetail");
    expect(chatBox).not.toContain("FinanceArtifactPreview");
  });
});
```

- [ ] **Step 2: Run the test and verify the finance bridge failure**

```bash
cd frontend
pnpm test -- tests/unit/core/finance-artifact-layout.test.ts
```

Expected: finance assertion FAIL; office assertion PASS.

- [ ] **Step 3: Connect artifact state inside the finance thread provider**

In `frontend/src/components/workspace/finance/finance-agent-panel.tsx`:

1. Remove the currently unused `ArrowLeftIcon`, `DownloadIcon`, and `LoaderCircleIcon` imports from this file because those icons now belong to the reader.
2. Add imports:

```ts
import { useArtifacts } from "@/components/workspace/artifacts";

import { isHtmlArtifact } from "./finance-artifact-files";
import { FinanceArtifactPreview } from "./finance-artifact-preview";
```

3. Render the bridge as a sibling immediately before `ChatBox` inside `ThreadContext.Provider`:

```tsx
    <ThreadContext.Provider value={{ thread }}>
      <FinanceHtmlArtifactReader threadId={uiThreadId} />
      <ChatBox threadId={uiThreadId} artifactsMode="side-panel">
        {/* existing chat content remains unchanged */}
      </ChatBox>
    </ThreadContext.Provider>
```

4. Add the bridge below `FinanceAgentPanelInner` and above todo helper functions:

```tsx
function FinanceHtmlArtifactReader({ threadId }: { threadId: string }) {
  const { artifacts, deselect, open, selectedArtifact } = useArtifacts();

  if (!open || !selectedArtifact || !isHtmlArtifact(selectedArtifact)) {
    return null;
  }

  return (
    <FinanceArtifactPreview
      artifacts={artifacts}
      filepath={selectedArtifact}
      onBack={deselect}
      threadId={threadId}
    />
  );
}
```

Do not change `ChatBox` or generic artifact components. Its existing effect remains the single owner of `collectResultFiles(thread.messages)`.

- [ ] **Step 4: Run focused integration and reader tests**

```bash
cd frontend
pnpm test -- tests/unit/core/finance-artifact-layout.test.ts tests/unit/components/workspace/finance-artifact-preview.test.tsx tests/unit/core/finance-artifact-files.test.ts tests/unit/core/coding-artifacts-layout.test.ts
```

Expected: all tests PASS, including generic artifact regression coverage.

- [ ] **Step 5: Run frontend typecheck**

```bash
cd frontend
pnpm typecheck
```

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 6: Commit only finance integration and its test**

Because `finance-agent-panel.tsx` was already modified before this work, inspect its staged diff carefully and include the combined intended file only after confirming no user content was lost:

```bash
git diff -- frontend/src/components/workspace/finance/finance-agent-panel.tsx
git add frontend/src/components/workspace/finance/finance-agent-panel.tsx frontend/tests/unit/core/finance-artifact-layout.test.ts
git diff --cached --name-status
git diff --cached -- frontend/src/components/workspace/finance/finance-agent-panel.tsx
git commit -m "feat(finance): open html results fullscreen"
```

### Task 4: Packaged Desktop CDN Allowlist

**Files:**
- Modify: `desktop/src/main.ts:325-336`
- Modify: `desktop/tests/window-security.test.mjs`

- [ ] **Step 1: Strengthen the CSP test before changing policy**

Replace the packaged CSP test in `desktop/tests/window-security.test.mjs` with:

```js
test("packaged app protocol serves html with a constrained content security policy", () => {
  assert.match(mainSource, /Content-Security-Policy/);
  assert.match(
    mainSource,
    /script-src 'self' 'unsafe-inline' https:\/\/cdn\.tailwindcss\.com https:\/\/cdn\.jsdelivr\.net/,
  );
  assert.doesNotMatch(mainSource, /script-src[^\n]*https:\s/);
  assert.doesNotMatch(mainSource, /unsafe-eval/);
  assert.match(mainSource, /frame-src 'self' blob:/);
  assert.match(mainSource, /object-src 'none'/);
});
```

- [ ] **Step 2: Run the desktop security test and verify it fails**

```bash
node --test desktop/tests/window-security.test.mjs
```

Expected: FAIL because the two CDN origins are not in `script-src`.

- [ ] **Step 3: Add only the approved script origins**

In `desktop/src/main.ts`, change only the `script-src` entry:

```ts
const PACKAGED_HTML_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");
```

- [ ] **Step 4: Run desktop security and type checks**

```bash
node --test desktop/tests/window-security.test.mjs
pnpm --dir desktop lint
```

Expected: all Node tests PASS and both desktop TypeScript projects typecheck.

- [ ] **Step 5: Commit the constrained CSP change**

```bash
git add desktop/src/main.ts desktop/tests/window-security.test.mjs
git diff --cached --name-status
git commit -m "fix(desktop): allow finance dashboard cdn scripts"
```

### Task 5: Full Verification And Real Dashboard QA

**Files:**
- No required source changes; adjust only files from Tasks 1-4 if verification exposes a defect.

- [ ] **Step 1: Run the focused test suite**

```bash
cd frontend
pnpm test -- tests/unit/core/finance-artifact-files.test.ts tests/unit/components/workspace/finance-artifact-preview.test.tsx tests/unit/core/finance-artifact-layout.test.ts tests/unit/core/coding-artifacts-layout.test.ts tests/unit/core/artifacts/loader.test.ts tests/unit/core/artifacts/authenticated-url.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run complete frontend quality checks**

```bash
cd frontend
pnpm check
pnpm test
```

Expected: ESLint, TypeScript, and the full Vitest suite PASS. If an unrelated pre-existing failure occurs, capture its exact test/file without modifying unrelated code.

- [ ] **Step 3: Run desktop verification**

```bash
node --test desktop/tests/*.test.mjs
pnpm --dir desktop build
```

Expected: desktop tests PASS and Electron TypeScript builds successfully.

- [ ] **Step 4: Start the application for visual QA**

Start the normal development stack from the repository root:

```bash
./start.sh start dev
```

Use the printed frontend URL, normally `http://localhost:9192`. If that port is occupied by an unrelated process, use the repository's supported alternate-port configuration rather than terminating the existing process.

- [ ] **Step 5: Verify the real runtime dashboard in the finance task**

Use the existing runtime artifact:

```text
/Users/libing/.kworks-workspace/data/qiongqi/users/runtime/workspace/reports/2026-07-10_market_linkage/dashboard.html
```

In the in-app browser or packaged desktop app:

1. Open the finance market-linkage task containing `dashboard.html`.
2. Click its preview action.
3. Confirm the fixed reader covers workspace sidebar, headers, chat, composer, and todo panels.
4. Confirm the dashboard heading, Tailwind layout, and Chart.js canvases are visible.
5. Inspect console output for CSP violations or `Chart is not defined`.
6. Click `下载 MD 报告` and confirm the requested filename is `daily_report.md`, not `AUDIT.md` or `one_liner.md`.
7. Click the arrow and confirm the same task, message scroll, composer content, and streaming state remain.

- [ ] **Step 6: Check desktop and narrow viewports**

Capture screenshots at approximately 1440x900 and 390x844. Verify:

- the toolbar remains 44 pixels tall;
- the filename truncates before overlapping actions;
- mobile hides the visible action labels while retaining accessible names;
- the iframe fills all remaining space;
- no workspace chrome appears above the reader;
- the canvas regions contain non-background pixels after Chart.js loads.

- [ ] **Step 7: Review the final diff and repository state**

```bash
git diff --check
git status --short
git log -5 --oneline --decorate
```

Expected: no whitespace errors; only the user's pre-existing unrelated changes remain unstaged; Tasks 1-4 appear as focused commits.

- [ ] **Step 8: Stop temporary development and brainstorming servers**

Stop only processes started during this implementation. Do not terminate pre-existing KWorks or user-owned processes. Stop the visual brainstorming session with:

```bash
/Users/libing/.agents/skills/brainstorming/scripts/stop-server.sh /Users/libing/kk_Projects/KWorks/.superpowers/brainstorm/45953-1783846749
```

Expected: temporary servers exit cleanly.
