import { expect, test } from "@playwright/test";

import { codingThreadStorageKey } from "../../src/core/projects/coding-thread-routes";

import { mockRuntimeAPI } from "./utils/mock-api";

test.describe("Sidebar navigation", () => {
  test("sidebar contains workspace feature nav links", async ({ page }) => {
    mockRuntimeAPI(page);

    await page.goto("/workspace/chats/new");

    // Sidebar uses data-sidebar="menu-button" with asChild rendering on <Link>
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.locator("a[href='/workspace/chats/new']")).toBeVisible(
      { timeout: 15_000 },
    );
    await expect(sidebar.locator("a[href='/workspace/skills']")).toBeVisible();
    await expect(sidebar.locator("a[href='/workspace/mcp']")).toBeVisible();
    await expect(
      sidebar.locator("a[href='/workspace/token-usage']"),
    ).toBeVisible();
    await expect(sidebar.locator("a[href='/workspace/crons']")).toBeVisible();
  });

  test("Skills link navigates to skills page", async ({ page }) => {
    mockRuntimeAPI(page);

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    const skillsLink = sidebar.locator("a[href='/workspace/skills']");
    await expect(skillsLink).toBeVisible({ timeout: 15_000 });
    await skillsLink.click();

    await page.waitForURL("**/workspace/skills");
    await expect(page).toHaveURL(/\/workspace\/skills/);
  });

  test("project task panel collapses and expands", async ({ page }) => {
    mockRuntimeAPI(page, {
      projects: [
        {
          id: "proj_kworks",
          name: "KWorks",
          path: "/tmp/kworks",
        },
      ],
      threads: [
        {
          thread_id: "thread_kworks",
          title: "实现侧栏项目任务",
          updated_at: "2026-07-01T09:20:00Z",
          workModeId: "coding",
          workspaceRoot: "/tmp/kworks",
        },
      ],
    });

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    const projectTaskToggle = sidebar.getByRole("button", {
      name: "项目 / 任务",
    });
    const projectTaskPanel = sidebar.locator("#sidebar-project-tasks-content");
    const projectLink = projectTaskPanel.getByRole("link", {
      name: /KWorks\s+\/tmp\/kworks/,
    });
    const taskLink = projectTaskPanel.getByRole("link", {
      name: /实现侧栏项目任务/,
    });
    await expect(projectTaskToggle).toBeVisible({ timeout: 15_000 });
    await expect(projectTaskToggle).toHaveAttribute("aria-expanded", "true");
    await expect(projectLink).toBeVisible();
    await expect(taskLink).toBeVisible();

    await projectTaskToggle.click();

    await expect(projectTaskToggle).toHaveAttribute("aria-expanded", "false");
    await expect(projectLink).toBeHidden();
    expect(
      await page.evaluate(() =>
        window.localStorage.getItem("kworks.sidebar.project-tasks.collapsed"),
      ),
    ).toBe("1");

    await projectTaskToggle.click();

    await expect(projectTaskToggle).toHaveAttribute("aria-expanded", "true");
    await expect(projectLink).toBeVisible();
    await expect(taskLink).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.localStorage.getItem("kworks.sidebar.project-tasks.collapsed"),
      ),
    ).toBe("0");
  });

  test("project task shortcuts open the selected task or start a fresh one", async ({
    page,
  }) => {
    mockRuntimeAPI(page, {
      projects: [
        {
          id: "proj_kworks",
          name: "KWorks",
          path: "/tmp/kworks",
        },
      ],
      threads: [
        {
          thread_id: "thread_kworks",
          title: "实现侧栏项目任务",
          updated_at: "2026-07-01T09:20:00Z",
          workModeId: "coding",
          workspaceRoot: "/tmp/kworks",
        },
      ],
    });

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    const projectTaskPanel = sidebar.locator("#sidebar-project-tasks-content");
    const taskLink = projectTaskPanel.getByRole("link", {
      name: /实现侧栏项目任务/,
    });
    const storageKey = codingThreadStorageKey("proj_kworks");
    await expect(taskLink).toBeVisible({ timeout: 15_000 });

    await page.evaluate((key) => {
      window.localStorage.setItem(key, "old-thread");
    }, storageKey);
    await taskLink.click();

    await page.waitForURL("**/workspace/coding/proj_kworks?thread=thread_kworks");
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), storageKey),
    ).toBe("thread_kworks");

    await page.goto("/workspace/chats/new");
    await expect(projectTaskPanel.getByText("项目新任务")).toBeVisible({
      timeout: 15_000,
    });
    await projectTaskPanel.getByText("项目新任务").click();

    await page.waitForURL("**/workspace/coding/proj_kworks?new=1");
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), storageKey),
    ).toBeNull();
  });

  test("collapsed workspace controls avoid macOS traffic lights", async ({
    page,
  }) => {
    await page.context().addCookies([
      {
        name: "sidebar_state",
        value: "true",
        url: "http://localhost:9192",
      },
    ]);
    mockRuntimeAPI(page);

    await page.goto("/workspace/chats/new");

    const trigger = page.getByTestId("workspace-sidebar-trigger");
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.click();

    await expect
      .poll(async () => {
        return trigger.evaluate((node) => node.getBoundingClientRect().left);
      })
      .toBeGreaterThanOrEqual(72);
  });
});
