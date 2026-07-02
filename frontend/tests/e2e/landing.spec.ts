import { expect, test } from "@playwright/test";

import { mockRuntimeAPI } from "./utils/mock-api";

test.describe("Landing page", () => {
  test("renders the header and hero section", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("header h1", { hasText: "KWorks" })).toBeVisible();
    await expect(page.locator("header h1")).not.toContainText("KKKWorks");
    await expect(page.getByRole("link", { name: "Docs" })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /github/i }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: /KWorks 由 QiongQi 引擎驱动/ }),
    ).toBeVisible();
    await expect(
      page.getByText("用纯 Node.js 的 QiongQi 作为唯一执行引擎"),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /进入工作台|探索平台/i }),
    ).toBeVisible();
  });

  test("Get Started link navigates to workspace", async ({ page }) => {
    mockRuntimeAPI(page);

    await page.goto("/");

    const getStarted = page.getByRole("link", { name: /进入工作台|探索平台/i });
    await getStarted.click();

    // Should redirect to /workspace/chats/new
    await page.waitForURL("**/workspace/chats/new");
    await expect(page).toHaveURL(/\/workspace\/chats\/new/);
  });
});
