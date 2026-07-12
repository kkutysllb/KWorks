# Finance Fullscreen Artifact Preview Design

## Summary

Financial quantitative work produces two complementary deliverables: a detailed Markdown report and an HTML dashboard. KWorks currently opens result files in the generic artifact side panel used by office tasks. That panel constrains the dashboard to roughly 40% of the workspace and, in the packaged desktop app, its blob-backed iframe inherits a Content Security Policy that blocks the dashboard's Tailwind and Chart.js CDN scripts.

Finance HTML artifacts will instead open in a dedicated full-viewport reader. The reader covers the workspace shell, preserves the underlying task state, provides a back action, and offers a direct download for the paired Markdown report. Office mode keeps its existing artifact side panel unchanged.

## Goals

- Render finance HTML dashboards across the complete application viewport.
- Keep the user inside KWorks instead of opening or downloading the HTML first.
- Return to the exact task state without navigation or reload.
- Provide one-click download of the corresponding Markdown analysis report.
- Preserve iframe isolation while allowing the known external resources used by finance dashboards.
- Make finance result presentation visibly and behaviorally distinct from office mode.

## Non-Goals

- Redesigning the generic office artifact panel.
- Building a general-purpose web browser or developer console.
- Supporting arbitrary authentication, popups, top-level navigation, or access from the dashboard to KWorks storage.
- Changing finance report generation or rewriting existing dashboard files.
- Adding a Markdown file picker for ambiguous matches.

## Current Behavior And Root Cause

`ChatBox` derives result files from file-producing tool calls and uses the shared artifacts context to open `ArtifactFileDetail` in a resizable side panel. HTML content is fetched as text, converted to a blob URL, and loaded into a sandboxed iframe.

The representative dashboard at `reports/2026-07-10_market_linkage/dashboard.html` imports:

- `https://cdn.tailwindcss.com`
- `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js`

The packaged desktop Content Security Policy currently allows only self-hosted and inline scripts. Blob documents inherit that policy, so these external scripts are blocked. The report can therefore lose its styling and all Chart.js visualizations even though it works when opened directly in a normal browser.

## User Experience

### Entry

Selecting an `.html` artifact from a finance task opens the finance reader instead of leaving the artifact visible as a right-side panel. Other finance artifact types continue to use the existing generic detail view.

### Reader Layout

The reader is a fixed, full-viewport layer above the workspace sidebar, workspace header, finance module header, chat, composer, and task panels.

It contains:

- A stable 44-pixel toolbar.
- A left-aligned arrow icon button with the accessible label `返回任务`.
- A centered, truncated artifact filename.
- A right-aligned icon-and-text button labeled `下载 MD 报告`.
- A content region that gives the iframe all remaining width and height.

The toolbar uses a restrained dark neutral surface with an emerald status accent. The report itself is not placed inside a decorative card and has no outer padding, so the dashboard owns the viewport below the toolbar.

### Exit

The back action closes the reader by clearing artifact selection/open state. It does not change routes, reload data, or reconstruct the finance panel. The underlying chat, scroll position, composer content, task progress, and streaming connection remain intact.

Pressing `Escape` performs the same action when focus is outside an embedded form control. Browser navigation is not involved.

### Markdown Download

The reader automatically resolves a companion Markdown path from the result files already recorded for the same task. Matching is deterministic:

1. A `.md` file in the same directory with the same stem as the HTML file.
2. A same-directory `.md` filename containing `report`, `analysis`, `报告`, or `分析`.
3. The latest eligible same-directory `.md` artifact.
4. The latest eligible `.md` artifact in the task.

Matching excludes auxiliary files whose basename contains `audit`, `one_liner`, `one-liner`, `readme`, `审计`, or `一句话`, unless no other Markdown artifact exists. Within the same priority, the last file in result-file order wins because that order reflects tool-call creation/update order.

If no Markdown artifact exists, the button is disabled and its tooltip states `未找到 Markdown 报告`. Download uses the existing authenticated artifact download helper and the resolved Markdown basename.

## Component Design

### `FinanceAgentPanel`

The finance panel remains responsible for thread ownership and continues using the existing `ChatBox` result-file synchronization. It renders the finance reader within the current `ArtifactsProvider` and `ThreadContext`, so it can observe selected artifact state and use the current thread ID without adding global state.

The reader activates only when all conditions are true:

- artifact state is open;
- a selected artifact exists;
- its normalized extension is `.html`;
- the current work mode is finance by construction of the finance panel.

The generic artifact side panel may still update behind the fixed layer, but it is not visible or interactive. Closing the reader also closes the artifact state, restoring the chat layout in one state transition.

### `FinanceArtifactPreview`

A focused finance-owned component will handle:

- HTML content loading and loading/error/empty states;
- construction and cleanup of the blob preview URL;
- iframe rendering and sandbox attributes;
- Markdown companion resolution;
- download pending/error feedback;
- back and keyboard actions.

The component depends only on the selected path, current artifact list, thread ID, and close callback. The Markdown matching algorithm lives in a pure exported helper so it can be tested without rendering React.

### Shared Artifact Components

The generic `ArtifactFileDetail`, `ArtifactFileList`, office chat flow, and coding flow remain unchanged unless a small shared helper is necessary. Finance-specific toolbar and matching semantics stay under `components/workspace/finance`.

## HTML Rendering And Security

The reader retains a sandboxed iframe without `allow-same-origin`. It may execute scripts and submit internal forms but cannot read the KWorks parent DOM, cookies, local storage, session storage, or authenticated API responses. It cannot navigate the top-level application or open popups.

The packaged desktop CSP will add only the external script origins required by the current finance dashboard format:

- `https://cdn.tailwindcss.com`
- `https://cdn.jsdelivr.net`

Inline scripts and styles remain permitted as they are today. Existing `img-src` rules already permit HTTPS chart images. The allowlist is intentionally origin-limited instead of allowing all HTTPS scripts.

Because future finance reports are expected to use online chart images, failure of a CDN script must not hide the entire report. The iframe load state and console-access limitations mean KWorks cannot reliably detect every resource failure; the product guarantee is that the HTML document loads and remains isolated. A top-level content load failure receives an explicit retry/download state, while an individual third-party asset failure remains visible as part of the report.

## States And Error Handling

- Loading: centered spinner and `正在加载金融看板...`.
- Empty HTML: empty-state message with HTML download action.
- Artifact fetch failure: error message, retry action, and HTML download action.
- Iframe ready: toolbar and full dashboard.
- Markdown resolving: button remains present but disabled.
- Markdown unavailable: disabled button with explanatory tooltip.
- Markdown download pending: spinner replaces the download icon and duplicate clicks are ignored.
- Markdown download failure: non-blocking error toast; the dashboard stays open.

Blob URLs are revoked whenever the selected artifact changes or the reader unmounts.

## Accessibility And Responsive Behavior

- Toolbar actions use native buttons, Lucide icons, visible labels, and explicit accessible names.
- Focus indicators remain visible against the dark toolbar.
- The filename uses truncation and never displaces either action group.
- On narrow screens, the centered filename hides before action labels become unreadable.
- The iframe has a meaningful title derived from the filename.
- The reader uses viewport-safe dimensions and does not rely on viewport-scaled font sizes.

## Testing

### Unit Tests

- Markdown matching for same-stem, semantic report name, same-directory fallback, task fallback, exclusions, Windows-style separators, and no-match cases.
- Finance reader activation only for selected HTML artifacts.
- Back action clears selection/open state without route navigation.
- Download calls the existing authenticated helper with the chosen Markdown path and filename.
- Loading, error, unavailable Markdown, and pending-download states.
- Office `ChatBox` remains configured for the generic side panel.

### Desktop Security Tests

- Packaged CSP continues to deny arbitrary external scripts.
- Tailwind CDN and jsDelivr are explicitly present in `script-src`.
- Frame policy continues to allow blob previews and deny arbitrary top-level embedding.

### Visual Verification

Use the real `dashboard.html` from the runtime workspace and verify:

- dashboard content and Chart.js canvases render in the packaged desktop app;
- the reader covers sidebar, headers, chat, composer, and floating task panels;
- returning restores the original finance task without reload;
- `daily_report.md` is selected instead of `AUDIT.md` or `one_liner.md`;
- desktop and narrow/mobile viewport layouts contain no overlaps or clipped controls.

## Acceptance Criteria

1. Clicking the finance task's `dashboard.html` preview displays the dashboard inside KWorks across the entire viewport.
2. The representative dashboard's Tailwind styling and Chart.js charts render in the packaged desktop app.
3. The back arrow returns to the unchanged task view.
4. `下载 MD 报告` downloads `daily_report.md` for the representative artifact set.
5. Office mode artifact behavior is unchanged.
6. The iframe remains sandboxed without same-origin, popup, or top-navigation permissions.
7. Relevant frontend and desktop tests pass.
