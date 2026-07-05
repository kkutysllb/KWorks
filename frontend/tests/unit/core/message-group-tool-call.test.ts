import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { zhCN } from "@/core/i18n";
import { describeToolCallDisplay } from "@/core/tools/tool-call-display";
import { explainToolCall } from "@/core/tools/utils";

const repoRoot = resolve(__dirname, "../../..");

describe("message group tool call display", () => {
  test("shows the command for bash calls without a description", () => {
    expect(
      describeToolCallDisplay(
        "bash",
        { command: "pnpm --dir frontend typecheck" },
        zhCN,
      ),
    ).toMatchObject({
      label: "执行命令",
      detail: {
        kind: "code",
        language: "bash",
        value: "pnpm --dir frontend typecheck",
      },
    });
  });

  test("shows qiongqi file tool paths", () => {
    expect(
      describeToolCallDisplay(
        "read",
        { path: "frontend/src/app/page.tsx" },
        zhCN,
      ),
    ).toMatchObject({
      label: "读取文件",
      detail: {
        kind: "badge",
        value: "frontend/src/app/page.tsx",
      },
    });

    expect(
      describeToolCallDisplay(
        "edit",
        { path: "frontend/src/app/page.tsx" },
        zhCN,
      ),
    ).toMatchObject({
      label: "编辑文件",
      detail: {
        kind: "badge",
        value: "frontend/src/app/page.tsx",
      },
    });
  });

  test("labels both current and legacy todo write tools as todo updates", () => {
    expect(
      explainToolCall(
        { name: "todo_write", args: { todos: [] } } as never,
        zhCN,
      ),
    ).toBe(zhCN.toolCalls.writeTodos);

    expect(
      explainToolCall(
        { name: "write_todos", args: { todos: [] } } as never,
        zhCN,
      ),
    ).toBe(zhCN.toolCalls.writeTodos);
  });

  test("shows search patterns and folders for qiongqi search tools", () => {
    expect(
      describeToolCallDisplay(
        "grep",
        { pattern: "executeCommand", path: "frontend/src" },
        zhCN,
      ),
    ).toMatchObject({
      label: "搜索文本 “executeCommand”",
      detail: {
        kind: "badge",
        value: "frontend/src",
      },
    });

    expect(
      describeToolCallDisplay(
        "find",
        { pattern: "*.test.ts", path: "frontend/tests" },
        zhCN,
      ),
    ).toMatchObject({
      label: "查找文件 “*.test.ts”",
      detail: {
        kind: "badge",
        value: "frontend/tests",
      },
    });
  });

  test("wraps command code in tool call details so long shell commands are fully visible", () => {
    const messageGroup = readFileSync(
      resolve(repoRoot, "src/components/workspace/messages/message-group.tsx"),
      "utf8",
    );

    expect(messageGroup).toMatch(
      /<CodeBlock[\s\S]*className="mx-0 cursor-pointer border-none px-0"[\s\S]*showLineNumbers=\{false\}[\s\S]*wrapLines/,
    );
  });
});
