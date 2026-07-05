// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  QiongqiThreadMirror,
  useQiongqiStream,
} from "@/core/threads/qiongqi-stream";
import type { Message } from "@/core/threads/qiongqi-types";
import type { RuntimeEvent, TurnItem } from "@/core/threads/qiongqi-types";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("@/core/api/fetcher", () => ({
  fetch: fetchMock,
}));

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "",
  isDesktop: () => false,
}));

type HarnessState = {
  messages: Message[];
};

type WorkModeHarnessState = HarnessState & {
  title?: string;
  workModeId?: string;
};

function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    id: "thread-a",
    title: "Thread A",
    workspace: "/repo",
    model: "minimax-m2",
    turns: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    latestSeq: 12,
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function sseResponse() {
  const stream = new ReadableStream<Uint8Array>({
    start() {
      // Keep the stream open until the hook aborts it.
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function parseRequestBody(
  init: RequestInit | undefined,
): Record<string, unknown> {
  if (typeof init?.body !== "string") {
    throw new Error("Expected request body to be a JSON string");
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

function assistantTextDelta({
  seq,
  text,
  status = "running",
}: {
  seq: number;
  text: string;
  status?: "running" | "completed";
}): RuntimeEvent {
  const item: TurnItem = {
    id: "item_text_turn-a",
    turnId: "turn-a",
    threadId: "thread-a",
    role: "assistant",
    status,
    createdAt: "2026-01-01T00:00:00Z",
    kind: "assistant_text",
    text,
  };
  return {
    kind: "assistant_text_delta",
    seq,
    timestamp: "2026-01-01T00:00:00Z",
    threadId: "thread-a",
    turnId: "turn-a",
    itemId: item.id,
    item,
  };
}

function completedAssistantText(text: string): RuntimeEvent {
  return completedAssistantTextItem("item_text_turn-a", text, 3);
}

function completedAssistantTextItem(
  itemId: string,
  text: string,
  seq: number,
): RuntimeEvent {
  const item: TurnItem = {
    id: itemId,
    turnId: "turn-a",
    threadId: "thread-a",
    role: "assistant",
    status: "completed",
    createdAt: "2026-01-01T00:00:00Z",
    kind: "assistant_text",
    text,
  };
  return {
    kind: "item_created",
    seq,
    timestamp: "2026-01-01T00:00:00Z",
    threadId: "thread-a",
    turnId: "turn-a",
    itemId: item.id,
    item,
  };
}

function controlledSseResponse() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
    },
  });
  const response = new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
  return {
    response,
    emit(event: RuntimeEvent) {
      controller?.enqueue(
        encoder.encode(
          `id: ${event.seq}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`,
        ),
      );
    },
  };
}

function SubmitHarness({ context }: { context: Record<string, unknown> }) {
  const stream = useQiongqiStream<HarnessState>({ threadId: "thread-a" });
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        void stream.submit(
          {
            messages: [
              {
                type: "human",
                content: [{ type: "text", text: "hello" }],
                additional_kwargs: {
                  files: [
                    {
                      filename: "note.md",
                      path: "att_123",
                      status: "uploaded",
                    },
                  ],
                },
              },
            ],
          },
          {
            threadId: "thread-a",
            context,
          },
        );
      },
    },
    "submit",
  );
}

function NewThreadSubmitHarness({
  requestedThreadId,
  modelName = "minimax-m2",
  workspaceRoot = "/repo",
  workModeId,
}: {
  requestedThreadId: string;
  modelName?: string;
  workspaceRoot?: string;
  workModeId?: string;
}) {
  const stream = useQiongqiStream<HarnessState>({});
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        void stream.submit(
          {
            messages: [
              {
                type: "human",
                content: [{ type: "text", text: "first message" }],
              },
            ],
          },
          {
            threadId: requestedThreadId,
            context: {
              ...(workspaceRoot ? { workspaceRoot } : {}),
              ...(modelName ? { model_name: modelName } : {}),
              ...(workModeId ? { workModeId } : {}),
            },
          },
        );
      },
    },
    "submit",
  );
}

function StreamValuesHarness() {
  const stream = useQiongqiStream<WorkModeHarnessState>({
    threadId: "thread-a",
  });
  return React.createElement("output", {
    "data-title": stream.values.title ?? "",
    "data-work-mode-id": stream.values.workModeId ?? "",
  });
}

function StreamMessageCountHarness() {
  const stream = useQiongqiStream<HarnessState>({
    threadId: "thread-a",
  });
  return React.createElement("output", {
    "data-count": String(stream.messages.length),
  });
}

function ExistingThreadWorkModeSubmitHarness() {
  const stream = useQiongqiStream<WorkModeHarnessState>({
    threadId: "thread-a",
  });
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("output", {
      "data-work-mode-id": stream.values.workModeId ?? "",
    }),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          void stream.submit(
            {
              messages: [
                {
                  type: "human",
                  content: [{ type: "text", text: "switch to coding" }],
                },
              ],
            },
            {
              threadId: "thread-a",
              context: {
                workspaceRoot: "/repo",
                model_name: "minimax-m2",
                workModeId: "coding",
              },
            },
          );
        },
      },
      "submit",
    ),
  );
}

function ExistingThreadWorkspaceHarness() {
  const stream = useQiongqiStream<HarnessState>({ threadId: "thread-a" });
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        void stream.submit(
          {
            messages: [
              {
                type: "human",
                content: [{ type: "text", text: "use mcp" }],
              },
            ],
          },
          {
            threadId: "thread-a",
            context: {
              workspaceRoot: "/repo",
              model_name: "minimax-m2",
            },
          },
        );
      },
    },
    "submit",
  );
}

describe("useQiongqiStream /v1 contract", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = undefined;
    container = undefined;
    vi.clearAllMocks();
  });

  test("subscribes from the thread snapshot latestSeq", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeThread({ latestSeq: 42 })))
      .mockResolvedValueOnce(sseResponse());

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(SubmitHarness, { context: {} }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const sseInit = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads/thread-a/events") &&
        (init as RequestInit | undefined)?.method === "GET",
    )?.[1] as RequestInit | undefined;
    expect(new Headers(sseInit?.headers).get("Last-Event-ID")).toBe("42");
  });

  test("coalesces multiple SSE item events into the next frame before syncing UI state", async () => {
    vi.useFakeTimers();
    const sse = controlledSseResponse();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeThread({ latestSeq: 0 })))
      .mockResolvedValueOnce(sse.response);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(StreamMessageCountHarness));
      await Promise.resolve();
      await Promise.resolve();
    });

    const output = container.querySelector("output");
    expect(output?.getAttribute("data-count")).toBe("0");

    await act(async () => {
      sse.emit(completedAssistantTextItem("item_text_1", "one", 1));
      sse.emit(completedAssistantTextItem("item_text_2", "two", 2));
      sse.emit(completedAssistantTextItem("item_text_3", "three", 3));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(output?.getAttribute("data-count")).toBe("0");

    await act(async () => {
      vi.advanceTimersByTime(16);
      await Promise.resolve();
    });

    expect(output?.getAttribute("data-count")).toBe("3");
    vi.useRealTimers();
  });

  test("exposes fetched thread work mode in stream values", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeThread({ workModeId: "coding" })))
      .mockResolvedValueOnce(sseResponse());

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(StreamValuesHarness));
      await Promise.resolve();
      await Promise.resolve();
    });

    const output = container.querySelector("output");
    expect(output?.getAttribute("data-title")).toBe("Thread A");
    expect(output?.getAttribute("data-work-mode-id")).toBe("coding");
  });

  test("updates an existing thread to the user-selected work mode before starting a turn", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeThread({ workModeId: "task" })))
      .mockResolvedValueOnce(sseResponse())
      .mockResolvedValueOnce(jsonResponse(makeThread({ workModeId: "coding" })))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            threadId: "thread-a",
            turnId: "turn-a",
            userMessageItemId: "item-a",
          },
          { status: 202 },
        ),
      );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(ExistingThreadWorkModeSubmitHarness));
      await Promise.resolve();
      await Promise.resolve();
    });

    const output = container.querySelector("output");
    expect(output?.getAttribute("data-work-mode-id")).toBe("task");

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(output?.getAttribute("data-work-mode-id")).toBe("coding");

    const updateThreadCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads/thread-a") &&
        (init as RequestInit | undefined)?.method === "PATCH",
    );
    expect(updateThreadCall).toBeDefined();
    expect(
      parseRequestBody(updateThreadCall?.[1] as RequestInit | undefined),
    ).toEqual({
      workspace: "/repo",
      workModeId: "coding",
    });

    const startTurnCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads/thread-a/turns") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(startTurnCall).toBeDefined();
    expect(
      parseRequestBody(startTurnCall?.[1] as RequestInit | undefined),
    ).toMatchObject({
      workModeId: "coding",
    });
  });

  test("starts turns with native qiongqi mode, reasoning, and attachment IDs", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeThread()))
      .mockResolvedValueOnce(sseResponse())
      .mockResolvedValueOnce(
        jsonResponse(
          {
            threadId: "thread-a",
            turnId: "turn-a",
            userMessageItemId: "item-a",
          },
          { status: 202 },
        ),
      );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(SubmitHarness, {
          context: {
            is_plan_mode: true,
            reasoning_effort: "minimal",
            model_name: "minimax-m2",
            approvalPolicy: "manual",
            sandboxMode: "danger-full-access",
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const startTurnBody = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads/thread-a/turns") &&
        (init as RequestInit | undefined)?.method === "POST",
    )?.[1] as RequestInit | undefined;
    const payload = parseRequestBody(startTurnBody);
    expect(payload).toMatchObject({
      prompt: "hello",
      model: "minimax-m2",
      mode: "plan",
      reasoningEffort: "off",
      approvalPolicy: "on-request",
      attachmentIds: ["att_123"],
    });
    expect(payload).not.toHaveProperty("sandboxMode");
    expect(payload).not.toHaveProperty("context");
    expect(payload).not.toHaveProperty("attachments");
  });

  test("normalizes todo update events to the array shape expected by workspace UI", () => {
    const mirror = new QiongqiThreadMirror();

    mirror.applyEvent({
      kind: "todos_updated",
      seq: 1,
      timestamp: "2026-01-01T00:00:00Z",
      threadId: "thread-a",
      todos: {
        items: [
          {
            id: "todo_1",
            content: "Review current diff",
            status: "in_progress",
          },
        ],
      },
    });

    expect(mirror.getTodos()).toEqual([
      {
        id: "todo_1",
        content: "Review current diff",
        status: "in_progress",
      },
    ]);
  });

  test("creates a requested new thread before starting its first turn", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(makeThread({ id: "draft-thread" }), { status: 201 }),
      )
      .mockResolvedValueOnce(sseResponse())
      .mockResolvedValueOnce(
        jsonResponse(
          {
            threadId: "draft-thread",
            turnId: "turn-a",
            userMessageItemId: "item-a",
          },
          { status: 202 },
        ),
      );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(NewThreadSubmitHarness, {
          requestedThreadId: "draft-thread",
        }),
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const createThreadCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(createThreadCall).toBeDefined();
    expect(
      parseRequestBody(createThreadCall?.[1] as RequestInit | undefined),
    ).toMatchObject({
      id: "draft-thread",
      workspace: "/repo",
      model: "minimax-m2",
    });

    const startTurnCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads/draft-thread/turns") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(startTurnCall).toBeDefined();
    expect(
      parseRequestBody(startTurnCall?.[1] as RequestInit | undefined),
    ).toMatchObject({
      prompt: "first message",
      model: "minimax-m2",
    });
  });

  test("passes product work mode id to new threads and their first turns", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(makeThread({ id: "draft-thread" }), { status: 201 }),
      )
      .mockResolvedValueOnce(sseResponse())
      .mockResolvedValueOnce(
        jsonResponse(
          {
            threadId: "draft-thread",
            turnId: "turn-a",
            userMessageItemId: "item-a",
          },
          { status: 202 },
        ),
      );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(NewThreadSubmitHarness, {
          requestedThreadId: "draft-thread",
          workModeId: "coding",
        }),
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const createThreadCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(createThreadCall).toBeDefined();
    expect(
      parseRequestBody(createThreadCall?.[1] as RequestInit | undefined),
    ).toMatchObject({
      workModeId: "coding",
    });

    const startTurnCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads/draft-thread/turns") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(startTurnCall).toBeDefined();
    expect(
      parseRequestBody(startTurnCall?.[1] as RequestInit | undefined),
    ).toMatchObject({
      workModeId: "coding",
    });
  });

  test("delegates the default workspace to the backend for new chats without a selected workspace", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(makeThread({ id: "draft-thread", workspace: "." }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(sseResponse())
      .mockResolvedValueOnce(
        jsonResponse(
          {
            threadId: "draft-thread",
            turnId: "turn-a",
            userMessageItemId: "item-a",
          },
          { status: 202 },
        ),
      );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(NewThreadSubmitHarness, {
          requestedThreadId: "draft-thread",
          workspaceRoot: "",
        }),
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const createThreadCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    const body = parseRequestBody(
      createThreadCall?.[1] as RequestInit | undefined,
    );
    expect(body).not.toHaveProperty("workspace");
  });

  test("updates existing thread workspace before starting a turn when the user selects a workspace", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeThread({ workspace: "default" })))
      .mockResolvedValueOnce(sseResponse())
      .mockResolvedValueOnce(jsonResponse(makeThread({ workspace: "/repo" })))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            threadId: "thread-a",
            turnId: "turn-a",
            userMessageItemId: "item-a",
          },
          { status: 202 },
        ),
      );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(ExistingThreadWorkspaceHarness));
      await Promise.resolve();
      await Promise.resolve();
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const updateThreadCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads/thread-a") &&
        (init as RequestInit | undefined)?.method === "PATCH",
    );
    expect(updateThreadCall).toBeDefined();
    expect(
      parseRequestBody(updateThreadCall?.[1] as RequestInit | undefined),
    ).toMatchObject({
      workspace: "/repo",
    });
  });

  test("omits model from new thread creation and first turn when no model is selected", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(makeThread({ id: "draft-thread", model: "user-active" }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(sseResponse())
      .mockResolvedValueOnce(
        jsonResponse(
          {
            threadId: "draft-thread",
            turnId: "turn-a",
            userMessageItemId: "item-a",
          },
          { status: 202 },
        ),
      );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(NewThreadSubmitHarness, {
          requestedThreadId: "draft-thread",
          modelName: "",
        }),
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const createThreadCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(createThreadCall).toBeDefined();
    expect(
      parseRequestBody(createThreadCall?.[1] as RequestInit | undefined),
    ).not.toHaveProperty("model");

    const startTurnCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/v1/threads/draft-thread/turns") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(startTurnCall).toBeDefined();
    expect(
      parseRequestBody(startTurnCall?.[1] as RequestInit | undefined),
    ).not.toHaveProperty("model");
  });
});

describe("QiongqiThreadMirror runtime events", () => {
  test("accumulates assistant text delta events that reuse the same item id", () => {
    const mirror = new QiongqiThreadMirror();

    mirror.applyEvent(
      assistantTextDelta({ seq: 1, text: "工具调用必须放在一个 " }),
    );
    mirror.applyEvent(
      assistantTextDelta({ seq: 2, text: "function_calls 块里" }),
    );

    expect(mirror.getMessages()).toMatchObject([
      {
        id: "item_text_turn-a",
        type: "ai",
        content: "工具调用必须放在一个 function_calls 块里",
      },
    ]);
  });

  test("replaces accumulated assistant text with the completed item snapshot", () => {
    const mirror = new QiongqiThreadMirror();

    mirror.applyEvent(assistantTextDelta({ seq: 1, text: "片段" }));
    mirror.applyEvent(completedAssistantText("完整最终文本"));

    expect(mirror.getMessages()).toMatchObject([
      {
        id: "item_text_turn-a",
        type: "ai",
        content: "完整最终文本",
      },
    ]);
  });

  test("exposes smoothed display messages without losing the full accumulated text", () => {
    const mirror = new QiongqiThreadMirror();

    mirror.applyEvent(assistantTextDelta({ seq: 1, text: "工具调用" }));

    expect(mirror.getMessages()[0]?.content).toBe("工具调用");
    expect(mirror.getDisplayMessages()[0]?.content).toBe("");

    expect(mirror.advanceDisplay(2)).toBe(true);
    expect(mirror.getDisplayMessages()[0]?.content).toBe("工具");
    expect(mirror.getMessages()[0]?.content).toBe("工具调用");

    mirror.flushDisplay();
    expect(mirror.getDisplayMessages()[0]?.content).toBe("工具调用");
  });
});
