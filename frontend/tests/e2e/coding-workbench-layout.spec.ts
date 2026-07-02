import { expect, test } from "@playwright/test";

import { mockRuntimeAPI } from "./utils/mock-api";

const THREAD_ID = "thread_coding_layout";
const PROJECT_ID = "proj_coding_layout";

test.describe("Coding workbench layout", () => {
  test("keeps todo floating panel in the right overlay stack", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    mockRuntimeAPI(page, {
      threads: [
        {
          thread_id: THREAD_ID,
          title: "Coding layout with todos",
          workModeId: "coding",
          workspaceRoot: "/tmp/coding-layout",
          todos: [
            {
              id: "todo-1",
              content: "检查输入区布局",
              status: "completed",
            },
            {
              id: "todo-2",
              content: "确认浮层不挤压对话列",
              status: "in_progress",
            },
          ],
        },
      ],
      projects: [
        {
          id: PROJECT_ID,
          name: "Coding Layout",
          path: "/tmp/coding-layout",
        },
      ],
    });

    await page.goto(`/workspace/coding/${PROJECT_ID}?thread=${THREAD_ID}`);

    await expect(page.getByTestId("coding-workbench-toolbar")).toBeVisible({
      timeout: 15_000,
    });

    const environmentCard = page.getByTestId("coding-environment-card");
    const floatingStack = page.getByTestId("coding-floating-panel-stack");
    const todoPanel = page.locator(".todo-floating-panel");
    const inspector = page.getByTestId("coding-agent-inspector");
    const inputShell = page.getByTestId("coding-agent-input-shell");

    await expect(environmentCard).toBeVisible();
    await expect(todoPanel).toBeVisible();

    const environmentBox = await environmentCard.boundingBox();
    const todoBox = await todoPanel.boundingBox();
    const inspectorBox = await inspector.boundingBox();
    const inputBox = await inputShell.boundingBox();

    if (!environmentBox || !todoBox || !inspectorBox || !inputBox) {
      throw new Error(
        "Expected coding workbench layout boxes to be measurable",
      );
    }

    expect(todoBox.y).toBeGreaterThan(environmentBox.y + environmentBox.height);
    expect(inputBox.x).toBeGreaterThanOrEqual(inspectorBox.x - 1);
    expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(
      inspectorBox.x + inspectorBox.width + 1,
    );

    await page.getByRole("button", { name: "切换环境信息面板" }).click();

    await expect(environmentCard).toHaveCount(0);
    await expect(todoPanel).toBeVisible();

    const movedTodoBox = await todoPanel.boundingBox();
    if (!movedTodoBox) {
      throw new Error("Expected todo panel to remain measurable");
    }
    expect(movedTodoBox.y).toBeLessThan(todoBox.y - 24);

    await page.getByRole("button", { name: "展开代码面板" }).click();

    await expect(floatingStack).toHaveCount(0);
  });
});
