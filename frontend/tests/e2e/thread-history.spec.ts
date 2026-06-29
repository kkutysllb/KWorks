import { expect, test } from "@playwright/test";

import {
  mockRuntimeAPI,
  MOCK_THREAD_ID,
  MOCK_THREAD_ID_2,
} from "./utils/mock-api";

const THREADS = [
  {
    thread_id: MOCK_THREAD_ID,
    title: "First conversation",
    updated_at: "2025-06-01T12:00:00Z",
    workModeId: "task",
  },
  {
    thread_id: MOCK_THREAD_ID_2,
    title: "Second conversation",
    updated_at: "2025-06-02T12:00:00Z",
    workModeId: "coding",
    workspaceRoot: "/tmp/coding-project",
  },
];

const PROJECTS = [
  {
    id: "proj_coding_1",
    name: "Coding Project",
    path: "/tmp/coding-project",
  },
];

test.describe("Thread history", () => {
  test("sidebar shows existing threads as work-mode history tasks", async ({
    page,
  }) => {
    mockRuntimeAPI(page, { threads: THREADS });

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByText("历史任务")).toBeVisible({
      timeout: 15_000,
    });
    await expect(sidebar.getByText("日常办公")).toBeVisible();
    await expect(sidebar.getByText("Coding 模式")).toBeVisible();
    await expect(sidebar.getByText("First conversation")).toBeVisible({
      timeout: 15_000,
    });
    await expect(sidebar.getByText("Second conversation")).toBeVisible();
  });

  test("work-mode task groups can be collapsed and expanded", async ({
    page,
  }) => {
    mockRuntimeAPI(page, { threads: THREADS });

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    const dailyOfficeToggle = sidebar.getByRole("button", {
      name: /日常办公/,
    });

    await expect(sidebar.getByText("First conversation")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dailyOfficeToggle).toHaveAttribute("aria-expanded", "true");

    await dailyOfficeToggle.click();

    await expect(dailyOfficeToggle).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar.getByText("First conversation")).toHaveCount(0);
    await expect(sidebar.getByText("Second conversation")).toBeVisible();

    await dailyOfficeToggle.click();

    await expect(dailyOfficeToggle).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar.getByText("First conversation")).toBeVisible();
  });

  test("clicking a thread in sidebar navigates to it", async ({ page }) => {
    mockRuntimeAPI(page, { threads: THREADS, projects: PROJECTS });

    await page.goto("/workspace/chats/new");

    // Wait for sidebar to populate
    const firstThread = page.getByText("First conversation");
    await expect(firstThread).toBeVisible({ timeout: 15_000 });

    // Click on the first thread
    await firstThread.click();

    // Should navigate to that thread's URL
    await page.waitForURL(`**/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(page).toHaveURL(new RegExp(MOCK_THREAD_ID));
  });

  test("clicking a coding history task opens the coding workbench", async ({
    page,
  }) => {
    mockRuntimeAPI(page, { threads: THREADS, projects: PROJECTS });

    await page.goto("/workspace/chats/new");

    const codingThread = page
      .locator("[data-sidebar='sidebar']")
      .getByRole("button", { name: /Second conversation/ });
    await expect(codingThread).toBeVisible({ timeout: 15_000 });

    await codingThread.click();

    await page.waitForURL("**/workspace/coding/proj_coding_1");
    await expect(page).toHaveURL(/\/workspace\/coding\/proj_coding_1$/);
    await expect(page.getByTestId("coding-workbench-toolbar")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("existing thread loads historical messages", async ({ page }) => {
    mockRuntimeAPI(page, { threads: THREADS });

    // Navigate directly to an existing thread
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

    // The historical AI response should be displayed
    await expect(
      page.getByText("Response in thread First conversation"),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("chats list page shows all threads", async ({ page }) => {
    mockRuntimeAPI(page, { threads: THREADS });

    await page.goto("/workspace/chats");

    // Both threads should be listed in the main content area
    const main = page.locator("main");
    await expect(main.getByText("First conversation")).toBeVisible({
      timeout: 15_000,
    });
    await expect(main.getByText("Second conversation")).toBeVisible();
  });
});
