import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("coding agent todo panel", () => {
  test("coding agent reports todos so the workbench can render the floating panel", () => {
    const agentPanel = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/agent-panel.tsx"),
      "utf8",
    );
    const workbench = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/coding-workbench.tsx"),
      "utf8",
    );

    expect(agentPanel).not.toContain(
      'import { TodoList } from "@/components/workspace/todo-list";',
    );
    expect(agentPanel).toContain("visibleTodos");
    expect(agentPanel).toContain("visibleTodoSignature");
    expect(agentPanel).toContain("getTodoItemsSignature");
    expect(agentPanel).toContain("onTodosChange?.(visibleTodosRef.current)");
    expect(agentPanel).toContain("return () => onTodosChange?.([])");
    expect(agentPanel).toContain("thread.values.todos");
    expect(agentPanel).toContain("todosFromThreadStateOrToolCalls");
    expect(agentPanel).toContain("isTodoWriteToolName(toolCall.name)");
    expect(agentPanel).not.toContain("todoPanelOccupiesSpace");
    expect(agentPanel).not.toContain("todoPanelContentOffsetClass");

    expect(workbench).toContain(
      'import { TodoList } from "@/components/workspace/todo-list";',
    );
    expect(workbench).toContain("const [agentTodos, setAgentTodos]");
    expect(workbench).toContain("showFloatingPanels");
    expect(workbench).toContain("CodingFloatingPanelStack");
    expect(workbench).toContain("onTodosChange={setAgentTodos}");
    expect(workbench).toContain("todos={agentTodos}");
    expect(workbench).toContain('variant="floating"');
  });
});
