import { expect, test } from "vitest";

import {
  displayTitleOfThread,
  pathOfThread,
  workModeLabelOfThread,
} from "@/core/threads/utils";

const staleAgentContext = (agent_name: string) =>
  ({ agent_name }) as unknown as { workModeId?: string; projectId?: string };

test("uses standard chat route when thread has no agent context", () => {
  expect(pathOfThread("thread-123")).toBe("/workspace/chats/thread-123");
  expect(
    pathOfThread({
      thread_id: "thread-123",
    }),
  ).toBe("/workspace/chats/thread-123");
});

test("uses standard chat route even when stale agent metadata exists", () => {
  expect(
    pathOfThread({
      thread_id: "thread-123",
      context: staleAgentContext("researcher"),
    }),
  ).toBe("/workspace/chats/thread-123");
});

test("uses coding workbench route when thread belongs to coding mode", () => {
  expect(
    pathOfThread({
      thread_id: "thread-coding",
      context: { workModeId: "coding" },
    }),
  ).toBe("/workspace/coding");
  expect(
    pathOfThread({
      thread_id: "thread-coding",
      context: { workModeId: "coding", projectId: "proj_123" },
    }),
  ).toBe("/workspace/coding/proj_123");
});

test("ignores provided stale agent context when pathOfThread is called with a thread id", () => {
  expect(pathOfThread({
    thread_id: "thread-123",
    context: staleAgentContext("ops agent"),
  })).toBe(
    "/workspace/chats/thread-123",
  );
});

test("uses standard chat route when thread metadata has stale agent_name", () => {
  expect(
    pathOfThread({
      thread_id: "thread-456",
      metadata: { agent_name: "coder" },
    }),
  ).toBe("/workspace/chats/thread-456");
});

test("ignores stale agent context and metadata together", () => {
  expect(
    pathOfThread({
      thread_id: "thread-789",
      context: staleAgentContext("from-context"),
      metadata: { agent_name: "from-metadata" },
    }),
  ).toBe("/workspace/chats/thread-789");
});

test("derives user-visible work mode labels for thread titles", () => {
  expect(
    workModeLabelOfThread({
      thread_id: "thread-task",
      context: { workModeId: "office" },
    }),
  ).toBe("日常办公");
  expect(
    workModeLabelOfThread({
      thread_id: "thread-coding",
      context: { workModeId: "coding" },
    }),
  ).toBe("Coding 模式");
  expect(
    workModeLabelOfThread({
      thread_id: "thread-custom",
      context: { workModeId: "research" },
    }, [{ id: "research", name: "研究模式" }]),
  ).toBe("研究模式");
});

test("prefixes display titles with the selected work mode without changing raw titles", () => {
  const thread = {
    thread_id: "thread-coding",
    values: { title: "检查当前项目" },
    context: { workModeId: "coding" },
  };

  expect(displayTitleOfThread(thread)).toBe("[Coding 模式] 检查当前项目");
});

test("prefixes display titles with custom work mode names instead of ids", () => {
  const thread = {
    thread_id: "thread-stock",
    values: { title: "当前工作模式下你有哪些技能" },
    context: { workModeId: "stock-quant" },
  };

  expect(
    displayTitleOfThread(thread, [{ id: "stock-quant", name: "股票量化" }]),
  ).toBe("[股票量化] 当前工作模式下你有哪些技能");
});

test("does not expose custom work mode ids while mode names are unavailable", () => {
  const thread = {
    thread_id: "thread-stock",
    values: { title: "当前工作模式下你有哪些技能" },
    context: { workModeId: "stock-quant" },
  };

  expect(displayTitleOfThread(thread, [])).toBe(
    "[自定义工作模式] 当前工作模式下你有哪些技能",
  );
});
