// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { TodoList } from "@/components/workspace/todo-list";

const sourcePath = resolve(
  __dirname,
  "../../../../src/components/workspace/todo-list.tsx",
);

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type TodoListTestProps = React.ComponentProps<typeof TodoList> & {
  onFloatingVisibilityChange?: (visible: boolean) => void;
};

function renderTodoList(
  todos: React.ComponentProps<typeof TodoList>["todos"],
  props: Partial<TodoListTestProps> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(TodoList, { todos, variant: "floating", ...props }),
    );
  });
  return { container, root };
}

describe("TodoList floating panel", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
  });

  test("renders a floating task panel with todo status", () => {
    ({ container, root } = renderTodoList([
      { id: "a", content: "分析项目", status: "completed" },
      { id: "b", content: "实现浮层", status: "in_progress" },
    ]));

    expect(container.textContent).toContain("任务步骤");
    expect(container.textContent).toContain("1/2");
    expect(container.textContent).toContain("分析项目");
    expect(container.textContent).toContain("实现浮层");
    expect(container.querySelector('[data-status="completed"]')).not.toBeNull();
    expect(
      container.querySelector('[data-status="in_progress"]'),
    ).not.toBeNull();
  });

  test("collapses and expands from the icon button", () => {
    ({ container, root } = renderTodoList([
      { id: "a", content: "分析项目", status: "pending" },
    ]));

    expect(container.textContent).toContain("分析项目");

    const toggle = container.querySelector<HTMLButtonElement>(
      '[aria-label="收起任务步骤"]',
    );
    expect(toggle).not.toBeNull();
    act(() => {
      toggle?.click();
    });

    expect(container.textContent).not.toContain("分析项目");
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label="展开任务步骤"]'),
    ).not.toBeNull();
  });

  test("can be closed and reappears when todo content changes", () => {
    ({ container, root } = renderTodoList([
      { id: "a", content: "分析项目", status: "pending" },
    ]));

    const close = container.querySelector<HTMLButtonElement>(
      '[aria-label="关闭任务步骤"]',
    );
    expect(close).not.toBeNull();
    act(() => {
      close?.click();
    });
    expect(container.textContent).not.toContain("任务步骤");

    act(() => {
      root?.render(
        React.createElement(TodoList, {
          todos: [
            { id: "a", content: "分析项目", status: "completed" },
            { id: "b", content: "验证结果", status: "in_progress" },
          ],
          variant: "floating",
        }),
      );
    });

    expect(container.textContent).toContain("任务步骤");
    expect(container.textContent).toContain("验证结果");
  });

  test("normalizes todos wrapped in an items object", () => {
    ({ container, root } = renderTodoList({
      items: [{ id: "a", content: "兼容旧数据", status: "pending" }],
    }));

    expect(container.textContent).toContain("兼容旧数据");
  });

  test("hides when todo input is null", () => {
    ({ container, root } = renderTodoList(null));

    expect(container.textContent).toBe("");
  });

  test("normalizes malformed todo item fields before rendering", () => {
    const malformedTodos = [
      {
        id: { nested: "bad-id" },
        content: { text: "对象内容" },
        status: "unknown",
      },
      null,
      { id: "ok", content: "保留字符串内容", status: "in_progress" },
    ] as unknown as React.ComponentProps<typeof TodoList>["todos"];

    expect(() => {
      ({ container, root } = renderTodoList(malformedTodos));
    }).not.toThrow();
    expect(container?.textContent).toContain("对象内容");
    expect(container?.textContent).toContain("保留字符串内容");
  });

  test("reports whether the floating panel occupies chat space", () => {
    const onFloatingVisibilityChange = vi.fn();
    ({ container, root } = renderTodoList(
      [{ id: "a", content: "分析项目", status: "pending" }],
      { onFloatingVisibilityChange },
    ));

    expect(onFloatingVisibilityChange).toHaveBeenLastCalledWith(true);

    const collapse = container.querySelector<HTMLButtonElement>(
      '[aria-label="收起任务步骤"]',
    );
    act(() => {
      collapse?.click();
    });
    expect(onFloatingVisibilityChange).toHaveBeenLastCalledWith(false);

    const expand = container.querySelector<HTMLButtonElement>(
      '[aria-label="展开任务步骤"]',
    );
    act(() => {
      expand?.click();
    });
    expect(onFloatingVisibilityChange).toHaveBeenLastCalledWith(true);

    const close = container.querySelector<HTMLButtonElement>(
      '[aria-label="关闭任务步骤"]',
    );
    act(() => {
      close?.click();
    });
    expect(onFloatingVisibilityChange).toHaveBeenLastCalledWith(false);

    act(() => {
      root?.render(
        React.createElement(TodoList, {
          todos: [
            { id: "a", content: "分析项目", status: "completed" },
            { id: "b", content: "验证结果", status: "in_progress" },
          ],
          variant: "floating",
          onFloatingVisibilityChange,
        }),
      );
    });
    expect(onFloatingVisibilityChange).toHaveBeenLastCalledWith(true);
  });

  test("uses a lightweight Codex-style list for the floating panel", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("todo-floating-panel");
    expect(source).toContain("todo-floating-list");
    expect(source).toContain("backdrop-blur-xl");
    expect(source).not.toContain("<QueueList");
  });
});
