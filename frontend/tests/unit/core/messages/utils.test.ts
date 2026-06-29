import { expect, test } from "vitest";

import {
  extractContentFromMessage,
  extractTextFromMessage,
  groupMessages,
  isHiddenFromUIMessage,
  stripInternalContent,
} from "@/core/messages/utils";

test("stripInternalContent removes internal planning blocks with non-breaking spaces in the header", () => {
  const leakedContent = [
    "SESSION\u00A0INTENT",
    "用户请求分析2026年5月22日A股大盘情况，生成结构化大盘分析报告。",
    "",
    "SUMMARY",
    "数据采集完成情况",
  ].join("\n");

  expect(stripInternalContent(leakedContent)).toBe("");
});

test("isHiddenFromUIMessage hides ai messages whose internal header uses non-breaking spaces", () => {
  const message = {
    type: "ai",
    content: [
      {
        type: "text",
        text: "SESSION\u00A0INTENT\n用户请求分析2026年5月22日A股大盘情况，生成结构化大盘分析报告。",
      },
    ],
    additional_kwargs: {},
  };

  expect(isHiddenFromUIMessage(message as never)).toBe(true);
});

test("isHiddenFromUIMessage hides summarization human messages with internal headers", () => {
  const message = {
    type: "human",
    name: "summary",
    content: [
      {
        type: "text",
        text: "SESSION INTENT\nThe user wants to review implementation progress.\n\nSUMMARY\nProject root available.",
      },
    ],
    additional_kwargs: {},
  };

  expect(isHiddenFromUIMessage(message as never)).toBe(true);
});

test("isHiddenFromUIMessage hides internal header messages even without metadata", () => {
  const message = {
    type: "human",
    content:
      "SESSION INTENT\nThe user wants to review implementation progress.\n\nSUMMARY\nProject root available.",
    additional_kwargs: {},
  };

  expect(isHiddenFromUIMessage(message as never)).toBe(true);
});

test("isHiddenFromUIMessage hides todo middleware reminders by protocol name", () => {
  const reminder = {
    type: "human",
    name: "todo_completion_reminder",
    content:
      "<system_reminder>\nYou have incomplete todo items.\n</system_reminder>",
    additional_kwargs: {},
  };

  expect(isHiddenFromUIMessage(reminder as never)).toBe(true);
});

test("isHiddenFromUIMessage hides known internal system reminders without metadata", () => {
  const reminder = {
    type: "human",
    name: "todo_reminder",
    content:
      "<system_reminder>\nYour todo list from earlier is no longer visible.\n</system_reminder>",
    additional_kwargs: {},
  };

  expect(isHiddenFromUIMessage(reminder as never)).toBe(true);
});

test("extractContentFromMessage strips internal planning blocks from tool messages", () => {
  const message = {
    type: "tool",
    content:
      "SESSION INTENT\n用户要求分析上周五的股指期货情况。\n\nSUMMARY\nTushare Token可用",
  };

  expect(extractContentFromMessage(message as never)).toBe("");
});

test("extractContentFromMessage strips internal planning blocks from ai array content", () => {
  const message = {
    type: "ai",
    content: [
      {
        type: "text",
        text: "SESSION INTENT\n用户要求分析上周五的股指期货情况。",
      },
    ],
    additional_kwargs: {},
  };

  expect(extractContentFromMessage(message as never)).toBe("");
});

test("stripInternalContent removes internal next steps blocks", () => {
  expect(stripInternalContent("NEXT STEPS\n- Continue the hidden plan")).toBe("");
});

test("isHiddenFromUIMessage hides screenshot-style internal planning summaries", () => {
  const message = {
    type: "ai",
    content: [
      "SESSION INTENT",
      "用户查询北京到西安的高铁车次信息。",
      "",
      "SUMMARY",
      "已完成内部检索和参数整理。",
      "",
      "ARTIFACTS",
      "None",
      "",
      "NEXT STEPS",
      "继续内部调度。",
    ].join("\n"),
    additional_kwargs: {},
  };

  expect(isHiddenFromUIMessage(message as never)).toBe(true);
});

test("extractContentFromMessage strips internal planning blocks from human messages", () => {
  const message = {
    type: "human",
    content: [
      "SESSION INTENT",
      "用户查询北京到西安的高铁车次信息。",
      "",
      "SUMMARY",
      "内部摘要。",
      "",
      "NEXT STEPS",
      "继续内部调度。",
    ].join("\n"),
    additional_kwargs: {},
  };

  expect(extractContentFromMessage(message as never)).toBe("");
});

test("extractTextFromMessage strips internal planning blocks from raw text paths", () => {
  const message = {
    type: "tool",
    content: "NEXT STEPS\nInternal middleware continuation details.",
    additional_kwargs: {},
  };

  expect(extractTextFromMessage(message as never)).toBe("");
});

test("reasoning-only ai messages are grouped as processing instead of assistant content", () => {
  const message = {
    id: "reasoning_1",
    type: "ai",
    content: "",
    additional_kwargs: {
      reasoning_content: "hidden reasoning",
    },
  };

  const groups = groupMessages([message as never], (group) => ({
    type: group.type,
    messages: group.messages.map((item) => item.id),
  }));

  expect(extractContentFromMessage(message as never)).toBe("");
  expect(groups).toEqual([
    {
      type: "assistant:processing",
      messages: ["reasoning_1"],
    },
  ]);
});

test("ai messages with both reasoning and visible content render as one assistant bubble", () => {
  const message = {
    id: "assistant_1",
    type: "ai",
    content: "这是最终回答",
    additional_kwargs: {
      reasoning_content: "内部计算过程",
    },
  };

  const groups = groupMessages([message as never], (group) => ({
    type: group.type,
    messages: group.messages.map((item) => item.id),
  }));

  expect(groups).toEqual([
    {
      type: "assistant",
      messages: ["assistant_1"],
    },
  ]);
});
