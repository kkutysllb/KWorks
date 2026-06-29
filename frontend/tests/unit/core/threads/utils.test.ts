import { expect, test } from "vitest";

import {
  displayTitleOfThread,
  pathOfThread,
  workModeLabelOfThread,
} from "@/core/threads/utils";

test("uses standard chat route when thread has no agent context", () => {
  expect(pathOfThread("thread-123")).toBe("/workspace/chats/thread-123");
  expect(
    pathOfThread({
      thread_id: "thread-123",
    }),
  ).toBe("/workspace/chats/thread-123");
});

test("uses agent chat route when thread context has agent_name", () => {
  expect(
    pathOfThread({
      thread_id: "thread-123",
      context: { agent_name: "researcher" },
    }),
  ).toBe("/workspace/agents/researcher/chats/thread-123");
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

test("uses provided context when pathOfThread is called with a thread id", () => {
  expect(pathOfThread("thread-123", { agent_name: "ops agent" })).toBe(
    "/workspace/agents/ops%20agent/chats/thread-123",
  );
});

test("uses agent chat route when thread metadata has agent_name", () => {
  expect(
    pathOfThread({
      thread_id: "thread-456",
      metadata: { agent_name: "coder" },
    }),
  ).toBe("/workspace/agents/coder/chats/thread-456");
});

test("prefers context.agent_name over metadata.agent_name", () => {
  expect(
    pathOfThread({
      thread_id: "thread-789",
      context: { agent_name: "from-context" },
      metadata: { agent_name: "from-metadata" },
    }),
  ).toBe("/workspace/agents/from-context/chats/thread-789");
});

test("derives user-visible work mode labels for thread titles", () => {
  expect(
    workModeLabelOfThread({
      thread_id: "thread-task",
      context: { workModeId: "task" },
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
    }),
  ).toBe("research");
});

test("prefixes display titles with the selected work mode without changing raw titles", () => {
  const thread = {
    thread_id: "thread-coding",
    values: { title: "检查当前项目" },
    context: { workModeId: "coding" },
  };

  expect(displayTitleOfThread(thread)).toBe("[Coding 模式] 检查当前项目");
});
