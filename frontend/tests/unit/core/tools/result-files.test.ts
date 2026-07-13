import { describe, expect, it } from "vitest";

import type { Message } from "@/core/threads/qiongqi-types";
import { collectResultFiles } from "@/core/tools/result-files";

function aiMessage(
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    id?: string;
  }>,
): Message {
  return {
    id: "msg_1",
    type: "ai",
    role: "assistant",
    content: "",
    tool_calls: toolCalls.map((tc, i) => ({
      id: tc.id ?? `call_${i}`,
      name: tc.name,
      args: tc.args,
      type: "tool_call",
    })),
  } as Message;
}

function userMessage(text: string): Message {
  return { id: "msg_u", type: "human", role: "user", content: text } as Message;
}

describe("collectResultFiles", () => {
  it("extracts paths from write/edit/str_replace tool calls", () => {
    const messages: Message[] = [
      userMessage("build it"),
      aiMessage([
        {
          name: "write",
          args: { path: "/workspace/src/index.ts", content: "..." },
        },
        {
          name: "edit",
          args: { file_path: "/workspace/README.md", old: "a", new: "b" },
        },
        {
          name: "str_replace",
          args: { filepath: "/workspace/config.json", find: "x", replace: "y" },
        },
      ]),
    ];
    expect(collectResultFiles(messages)).toEqual([
      "/workspace/src/index.ts",
      "/workspace/README.md",
      "/workspace/config.json",
    ]);
  });

  it("ignores non-file-producing tools", () => {
    const messages: Message[] = [
      aiMessage([
        { name: "read", args: { path: "/workspace/foo.ts" } },
        { name: "bash", args: { command: "ls" } },
        { name: "write", args: { path: "/workspace/out.txt", content: "hi" } },
      ]),
    ];
    expect(collectResultFiles(messages)).toEqual(["/workspace/out.txt"]);
  });

  it("prefers materialized bash result files over tmp redirect paths", () => {
    const messages: Message[] = [
      aiMessage([
        {
          id: "call_bash",
          name: "bash",
          args: {
            command: "printf linkage > /tmp/market_linkage_daily.txt",
          },
        },
      ]),
      {
        id: "tool_1",
        type: "tool",
        role: "tool",
        tool_call_id: "call_bash",
        content: JSON.stringify({
          result_files: [
            {
              path: "/workspace/market_linkage_daily.txt",
              relative_path: "market_linkage_daily.txt",
              source_path: "/tmp/market_linkage_daily.txt",
            },
          ],
        }),
      } as Message,
    ];

    expect(collectResultFiles(messages)).toEqual(["market_linkage_daily.txt"]);
  });

  it("sanitizes tmp redirect paths while a bash result is still pending", () => {
    const messages: Message[] = [
      aiMessage([
        {
          name: "bash",
          args: {
            command: "printf linkage > /tmp/market_linkage_daily.txt",
          },
        },
      ]),
    ];

    expect(collectResultFiles(messages)).toEqual(["market_linkage_daily.txt"]);
  });

  it("deduplicates paths written multiple times", () => {
    const messages: Message[] = [
      aiMessage([
        { name: "write", args: { path: "/workspace/a.txt", content: "1" } },
        {
          name: "edit",
          args: { path: "/workspace/a.txt", old: "1", new: "2" },
        },
      ]),
    ];
    expect(collectResultFiles(messages)).toEqual(["/workspace/a.txt"]);
  });

  it("returns empty for messages without tool calls", () => {
    expect(collectResultFiles([userMessage("hello")])).toEqual([]);
    expect(collectResultFiles([])).toEqual([]);
  });

  it("skips tool calls with no path argument", () => {
    const messages: Message[] = [
      aiMessage([{ name: "write", args: { content: "no path here" } }]),
    ];
    expect(collectResultFiles(messages)).toEqual([]);
  });
});
