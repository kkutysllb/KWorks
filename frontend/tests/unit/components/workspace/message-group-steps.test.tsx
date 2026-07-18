// Pure-logic test (no DOM rendering). `convertToSteps` and its step types live
// in the render-free `message-steps` module (extracted from message-group.tsx,
// whose import graph pulls the Streamdown/katex render tree). node environment.
// @vitest-environment node
import { describe, expect, test } from "vitest";

import { convertToSteps } from "@/components/workspace/messages/message-steps";
import type { Message } from "@/core/threads/qiongqi-types";

function aiWithToolCall(
  toolCallId: string,
  args: Record<string, unknown>,
  status: "pending" | "running" | "completed" | "failed" = "pending",
): Message {
  return {
    id: "m1",
    type: "ai",
    content: "",
    tool_calls: [{ id: toolCallId, name: "bash", args }],
    additional_kwargs: {
      qiongqi_item: {
        id: "i1",
        kind: "tool_call",
        toolName: "bash",
        callId: toolCallId,
        toolKind: "command_execution",
        arguments: args,
        status,
        role: "assistant",
        turnId: "t1",
        threadId: "th1",
        createdAt: "",
      },
    },
  } as Message;
}

function toolResult(
  callId: string,
  output: unknown,
  options: {
    isError?: boolean;
    status?: "pending" | "running" | "completed" | "failed";
  } = {},
): Message {
  const isError = options.isError ?? false;
  const status = options.status ?? (isError ? "failed" : "completed");
  return {
    id: "m2",
    type: "tool",
    tool_call_id: callId,
    content: JSON.stringify(output),
    additional_kwargs: {
      qiongqi_item: {
        id: "i2",
        kind: "tool_result",
        toolName: "bash",
        callId,
        toolKind: "command_execution",
        output,
        isError,
        status,
        role: "tool",
        turnId: "t1",
        threadId: "th1",
        createdAt: "",
      },
    },
  } as Message;
}

describe("convertToSteps reads tool status and bash output", () => {
  // Each test produces exactly one tool-call step; narrow + assert presence so
  // TypeScript can see the CoTToolCallStep arm (and satisfy
  // noUncheckedIndexedAccess on steps[0]).
  function toolCallStep(messages: Message[]) {
    const steps = convertToSteps(messages);
    const step = steps.find((s) => s.type === "toolCall");
    expect(step).toBeDefined();
    expect(step?.type).toBe("toolCall");
    return step!;
  }

  test("pending tool call has status pending, no output", () => {
    const step = toolCallStep([aiWithToolCall("c1", { command: "ls" })]);
    expect(step.status).toBe("pending");
    expect(step.outputText).toBeUndefined();
    expect(step.exitCode).toBeUndefined();
  });

  test("completed bash call surfaces output + exit code", () => {
    const step = toolCallStep([
      aiWithToolCall("c1", { command: "npm run build" }, "completed"),
      toolResult("c1", {
        command: "npm run build",
        cwd: "/r",
        shell: "/bin/zsh",
        exit_code: 0,
        output: "built ok",
        full_output_path: null,
        truncation: null,
      }),
    ]);
    expect(step.status).toBe("completed");
    expect(step.exitCode).toBe(0);
    expect(step.outputText).toBe("built ok");
  });

  test("failed bash call surfaces exit code 1 and isError", () => {
    const step = toolCallStep([
      aiWithToolCall("c1", { command: "npm test" }, "failed"),
      toolResult(
        "c1",
        {
          command: "npm test",
          cwd: "/r",
          shell: "/bin/zsh",
          exit_code: 1,
          output: "FAIL",
          full_output_path: null,
          truncation: null,
        },
        { isError: true },
      ),
    ]);
    expect(step.status).toBe("failed");
    expect(step.isError).toBe(true);
    expect(step.exitCode).toBe(1);
  });

  test("running tool_result promotes the step status to running", () => {
    const step = toolCallStep([
      aiWithToolCall("c1", { command: "npm run dev" }),
      toolResult(
        "c1",
        {
          command: "npm run dev",
          cwd: "/r",
          shell: "/bin/zsh",
          exit_code: null,
          output: "VITE ready",
          full_output_path: null,
          truncation: null,
          partial: true,
        },
        { status: "running" },
      ),
    ]);
    expect(step.status).toBe("running");
    expect(step.outputText).toBe("VITE ready");
  });

  test("keeps runtime progress separate from provider reasoning", () => {
    const progress: Message = {
      id: "progress-1",
      type: "ai",
      content: "",
      additional_kwargs: {
        qiongqi_item: {
          kind: "runtime_progress",
          id: "progress-1",
          phase: "executing",
          summary: "正在整理证据",
          modelSteps: 2,
          toolCalls: 3,
          evidenceCount: 4,
          artifactCount: 1,
        },
      },
    } as Message;
    const steps = convertToSteps([progress]);
    expect(steps).toMatchObject([{ type: "progress", summary: "正在整理证据", toolCalls: 3 }]);
  });
});
