import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("coding agent todo panel", () => {
  test("coding agent renders the shared floating todo panel from thread state", () => {
    const agentPanel = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/agent-panel.tsx"),
      "utf8",
    );

    expect(agentPanel).toContain(
      'import { TodoList } from "@/components/workspace/todo-list";',
    );
    expect(agentPanel).toContain("todoPanelOccupiesSpace");
    expect(agentPanel).toContain("visibleTodos");
    expect(agentPanel).toContain("thread.values.todos");
    expect(agentPanel).toContain("todosFromThreadStateOrToolCalls");
    expect(agentPanel).toContain("isTodoWriteToolName(toolCall.name)");
    expect(agentPanel).toContain('variant="floating"');
    expect(agentPanel).toContain("onFloatingVisibilityChange");
  });
});
