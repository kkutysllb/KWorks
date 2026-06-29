import { expect, test } from "@playwright/test";

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
