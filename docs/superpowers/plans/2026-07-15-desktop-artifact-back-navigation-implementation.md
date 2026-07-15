# Desktop Artifact Back Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the finance HTML dashboard “返回任务” action reliably clickable in macOS Electron windows and prove it with native Electron hit-testing rather than browser-only event tests.

**Architecture:** Mark the complete artifact toolbar as an Electron no-drag interactive region, route button and Escape through one stable close callback, and add layered React/CSS/Electron tests. The artifact context remains the navigation authority through `deselect()`; no router-history workaround is introduced.

**Tech Stack:** React 19, Tailwind CSS 4, Electron 33 hiddenInset titlebar, Vitest, Testing Library, Playwright Electron.

**Specification:** `docs/superpowers/specs/2026-07-15-task-continuity-and-desktop-artifact-navigation-design.md`

---

## Task 1: Reproduce the desktop titlebar hit-test failure

**Files:**
- Modify: `frontend/tests/unit/core/desktop-titlebar-drag.test.ts`
- Modify: `frontend/tests/unit/components/workspace/finance-artifact-preview.test.tsx`

- [ ] **Step 1: Add failing desktop-region assertions**

```ts
test('marks the finance artifact toolbar as a no-drag interactive region', () => {
  const source = read('src/components/workspace/finance/finance-artifact-preview.tsx')
  expect(source).toContain('desktop-no-drag')
  expect(source).toContain('data-desktop-no-drag')
})
```

Update the component test to assert the banner and return button expose the contract:

```ts
expect(screen.getByRole('banner')).toHaveClass('desktop-no-drag')
expect(screen.getByRole('button', { name: '返回任务' })).toHaveAttribute('data-desktop-no-drag')
```

- [ ] **Step 2: Run RED**

```bash
cd /Users/libing/kk_Projects/KWorks/frontend
pnpm exec vitest run tests/unit/core/desktop-titlebar-drag.test.ts tests/unit/components/workspace/finance-artifact-preview.test.tsx
```

Expected: FAIL because the toolbar/button only use pointer-events classes.

- [ ] **Step 3: Commit the failing regression tests**

```bash
git add tests/unit/core/desktop-titlebar-drag.test.ts tests/unit/components/workspace/finance-artifact-preview.test.tsx
git commit -m "test: reproduce desktop artifact toolbar hit test"
```

## Task 2: Fix toolbar hit testing and close semantics

**Files:**
- Modify: `frontend/src/components/workspace/finance/finance-artifact-preview.tsx`
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/tests/unit/components/workspace/finance-artifact-preview.test.tsx`

- [ ] **Step 1: Use one stable close callback**

Add:

```ts
const closePreview = useCallback(() => {
  onBack();
}, [onBack]);
```

Use `closePreview` for both the document Escape handler and button `onClick`. Do not call router navigation or `window.history.back()`.

- [ ] **Step 2: Mark the entire toolbar and button no-drag**

```tsx
<header className="desktop-no-drag relative z-20 flex h-11 shrink-0 items-center bg-neutral-950 px-2 text-neutral-100">
  ...
  <Button
    data-desktop-no-drag
    aria-label="返回任务"
    onClick={closePreview}
    ...
  >
```

Keep the iframe main region at `z-0`; do not add an overlay above the toolbar.

- [ ] **Step 3: Strengthen CSS contract**

Keep the existing selector and add an explicit attribute rule so portal content does not depend on a draggable ancestor:

```css
.desktop-no-drag,
[data-desktop-no-drag],
.desktop-titlebar-drag :is(a, button, input, textarea, select, [role="button"], [data-desktop-no-drag]) {
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 4: Verify GREEN**

```bash
pnpm exec vitest run tests/unit/core/desktop-titlebar-drag.test.ts tests/unit/components/workspace/finance-artifact-preview.test.tsx tests/unit/components/workspace/finance-html-artifact-reader.test.tsx
pnpm run typecheck
```

Expected: PASS; button and Escape each call the same `onBack` once, focus/inert tests remain green.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/finance/finance-artifact-preview.tsx src/styles/globals.css tests/unit/core/desktop-titlebar-drag.test.ts tests/unit/components/workspace/finance-artifact-preview.test.tsx
git commit -m "fix: make desktop artifact toolbar interactive"
```

## Task 3: Add native Electron navigation regression coverage

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/pnpm-lock.yaml`
- Create: `desktop/playwright.config.ts`
- Create: `desktop/tests/e2e/artifact-back-navigation.spec.ts`
- Create: `desktop/tests/fixtures/artifact-preview.html`

- [ ] **Step 1: Add Playwright Electron as a desktop dev dependency**

```bash
cd /Users/libing/kk_Projects/KWorks/desktop
pnpm add -D @playwright/test@^1.59.1
```

Add scripts:

```json
{
  "test:e2e": "playwright test",
  "test:e2e:artifact": "playwright test tests/e2e/artifact-back-navigation.spec.ts"
}
```

- [ ] **Step 2: Create a native hit-test fixture**

The fixture must contain a full-width `-webkit-app-region: drag` toolbar and a top-right button marked `-webkit-app-region: no-drag`. Clicking it sets `document.body.dataset.closed = 'true'` and hides the preview. This isolates Electron native hit testing from backend state.

```html
<header style="height:44px;-webkit-app-region:drag;background:#0a0a0a">
  <button id="back" style="float:right;height:32px;-webkit-app-region:no-drag">返回任务</button>
</header>
<main id="preview">dashboard</main>
<script>
  document.querySelector('#back').addEventListener('click', () => {
    document.body.dataset.closed = 'true';
    document.querySelector('#preview').hidden = true;
  });
</script>
```

- [ ] **Step 3: Write the Electron Playwright test**

```ts
import { _electron as electron, expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('top-right artifact action receives clicks inside hiddenInset titlebar', async () => {
  const app = await electron.launch({
    args: [resolve('.')],
    env: { ...process.env, KWORKS_SKIP_BACKEND_AUTOLAUNCH: '1' }
  })
  try {
    const page = await app.firstWindow()
    const fixture = readFileSync(resolve('tests/fixtures/artifact-preview.html'), 'utf8')
    await page.setContent(fixture)
    await page.getByRole('button', { name: '返回任务' }).click()
    await expect(page.locator('body')).toHaveAttribute('data-closed', 'true')
    await expect(page.locator('#preview')).toBeHidden()
  } finally {
    await app.close()
  }
})
```

Configure the Electron test to run serially on macOS. Skip with an explicit reason on non-darwin platforms; the React/CSS tests remain cross-platform.

- [ ] **Step 4: Run the native test**

```bash
pnpm run build
pnpm run test:e2e:artifact
```

Expected: PASS in a real Electron BrowserWindow using hiddenInset titlebar.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts tests/e2e/artifact-back-navigation.spec.ts tests/fixtures/artifact-preview.html
git commit -m "test: cover electron artifact back navigation"
```

## Task 4: Build and smoke the packaged desktop application

**Files:**
- Verification task; no planned source files.

- [ ] **Step 1: Run frontend and desktop verification**

```bash
cd /Users/libing/kk_Projects/KWorks/frontend
pnpm exec vitest run tests/unit/core/desktop-titlebar-drag.test.ts tests/unit/components/workspace/finance-artifact-preview.test.tsx
pnpm run typecheck
CI=true pnpm run build:desktop

cd /Users/libing/kk_Projects/KWorks/desktop
pnpm run build
pnpm run prepare:package-resources
pnpm run verify:package-resources
```

- [ ] **Step 2: Build without publishing**

```bash
cd /Users/libing/kk_Projects/KWorks/desktop
pnpm exec electron-builder --mac --publish never
pnpm run verify:built-package-resources
```

- [ ] **Step 3: Perform packaged smoke**

Launch the generated `.app`, open a finance HTML artifact, click “返回任务” twice across two open/close cycles, and record the app path plus result in `progress.md`. Confirm the click does not drag the window and Escape still closes the preview.

- [ ] **Step 4: Final repository checks**

```bash
cd /Users/libing/kk_Projects/KWorks
git diff --check
git status --short
git branch --show-current
```

Expected: branch is `main`; no unrelated files are staged; no temporary task branch or worktree exists.

## Final Verification Checklist

- [ ] Toolbar and button expose Electron no-drag semantics.
- [ ] React click and Escape tests pass.
- [ ] Native Electron hiddenInset hit-test passes.
- [ ] Frontend desktop export succeeds.
- [ ] Desktop main/preload build succeeds.
- [ ] macOS app package builds without publication.
- [ ] Packaged app returns to the original finance task in two consecutive cycles.
