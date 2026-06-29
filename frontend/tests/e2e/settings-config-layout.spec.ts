import { expect, test } from "@playwright/test";

import { mockRuntimeAPI, type MockModel } from "./utils/mock-api";

const longModelName =
  "deepseek-r1-ultra-long-display-name-for-layout-regression-" + "x".repeat(90);

const longModel: MockModel = {
  id: "long-model-1",
  name: longModelName,
  display_name: longModelName,
  use: "deepseek-openai-compatible-provider-with-a-very-long-route-name",
  model:
    "deepseek-reasoner-with-an-extraordinarily-long-model-identifier-" +
    "y".repeat(80),
  supports_thinking: true,
  supports_vision: true,
};

test.describe("System config layout", () => {
  test("keeps model actions visible when configured models have long names", async ({
    page,
  }) => {
    await page.context().addCookies([
      {
        name: "sidebar_state",
        value: "true",
        url: "http://localhost:9192",
      },
    ]);
    mockRuntimeAPI(page, { models: [longModel] });

    await page.goto("/workspace/chats/new");
    await page.getByRole("button", { name: /e2e@test\.local/i }).click();
    await page.getByRole("menuitem", { name: /^(Settings|设置)$/ }).click();
    await expect(page).toHaveURL(/\/workspace\/settings/);

    await expect(page.getByText("功能区")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "账号与鉴权" })).toBeVisible();
    await expect(page.getByText("个人资料")).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("button", { name: "模型 Profiles" })
      .click();

    await expect(page.getByText(longModelName)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: "添加 Profile" }).first(),
    ).toBeVisible();

    const bounds = await page.evaluate(() => {
      const pageElement = document.querySelector("main");
      if (!pageElement) throw new Error("settings page missing");
      const buttons = Array.from(pageElement.querySelectorAll("button"));
      const findButton = (text: string) => {
        const button = buttons.find((node) => node.textContent?.includes(text));
        if (!button) throw new Error(`${text} button missing`);
        return button;
      };
      const rectOf = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      };
      return {
        viewportWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        pageClientWidth: pageElement.clientWidth,
        pageScrollWidth: pageElement.scrollWidth,
        page: rectOf(pageElement),
        add: rectOf(findButton("添加 Profile")),
      };
    });

    expect(bounds.docScrollWidth).toBeLessThanOrEqual(bounds.viewportWidth + 2);
    expect(bounds.pageScrollWidth).toBeLessThanOrEqual(
      bounds.pageClientWidth + 2,
    );
    for (const button of [bounds.add]) {
      expect(button.left).toBeGreaterThanOrEqual(bounds.page.left - 2);
      expect(button.right).toBeLessThanOrEqual(bounds.page.right + 2);
      expect(button.width).toBeGreaterThan(0);
    }
  });
});
