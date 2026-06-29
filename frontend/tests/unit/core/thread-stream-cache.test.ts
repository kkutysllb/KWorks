// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  streamState,
  ensureThreadMock,
  submitMock,
  stopMock,
  fetchMock,
  queryState,
  queryClient,
  updateSubtask,
  streamOptions,
  toastError,
} = vi.hoisted(() => ({
  streamState: {
    messages: [] as Message[],
    isLoading: false,
  },
  ensureThreadMock: vi.fn(),
  submitMock: vi.fn(),
  stopMock: vi.fn(async () => undefined),
  fetchMock: vi.fn(),
  queryState: {
    data: [] as unknown,
  },
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueriesData: vi.fn(),
  },
  updateSubtask: vi.fn(),
  streamOptions: {
    current: undefined as
      | {
          onError?: (error: unknown) => void;
          onThreadId?: (threadId: string) => void;
        }
      | undefined,
  },
  toastError: vi.fn(),
}));

vi.mock("@/core/threads/qiongqi-stream", () => ({
  useQiongqiStream: vi.fn((options) => {
    streamOptions.current = options;
    return {
      messages: streamState.messages,
      isLoading: streamState.isLoading,
      values: {},
      error: null,
      ensureThread: ensureThreadMock,
      submit: submitMock,
      stop: stopMock,
      joinStream: vi.fn(),
    };
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(() => ({ data: queryState.data })),
  useQueryClient: vi.fn(() => queryClient),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: toastError,
    info: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/core/i18n/hooks", () => ({
  useI18n: () => ({
    t: {
      uploads: {
        uploadingFiles: "Uploading files",
      },
    },
  }),
}));

vi.mock("@/core/api/fetcher", () => ({
  fetch: fetchMock,
}));

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "",
  isDesktop: () => false,
}));

vi.mock("@/core/tasks/context", () => ({
  useUpdateSubtask: () => updateSubtask,
}));

vi.mock("@/core/uploads", () => ({
  promptInputFilePartToFile: vi.fn(),
  uploadFiles: vi.fn(),
}));

import { useThreadStream } from "@/core/threads/hooks";
import type { Message, Run } from "@/core/threads/qiongqi-types";
import { setCachedThreadState } from "@/core/threads/thread-state-store";
import type { AgentThreadState } from "@/core/threads/types";
import { promptInputFilePartToFile, uploadFiles } from "@/core/uploads";
import {
  clearThreadRuntimeSnapshot,
  useThreadRuntimeSnapshot,
} from "@/core/workspace-runtime";

function makeState(messages: Message[] = []): AgentThreadState {
  return {
    title: "",
    messages,
    artifacts: [],
  };
}

function visibleText(message: Message): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function makeRun(runId: string, status: Run["status"]): Run {
  return {
    run_id: runId,
    thread_id: "thread-a",
    assistant_id: "lead_agent",
    status,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    metadata: {},
    kwargs: {},
    multitask_strategy: "reject",
  } as Run;
}

function Harness({ threadId }: { threadId: string }) {
  const { thread } = useThreadStream({
    threadId,
    context: { mode: undefined },
    isMock: true,
  });
  return React.createElement(
    "div",
    { "data-testid": "messages" },
    thread.messages.map((message) => visibleText(message)).join("|"),
  );
}

function SubmitHarness({ threadId }: { threadId: string }) {
  const { sendMessage } = useThreadStream({
    threadId,
    context: { mode: undefined },
    isMock: false,
  });
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        void sendMessage(threadId, { text: "keep working", files: [] });
      },
    },
    "submit",
  );
}

function PlanSubmitHarness({ threadId }: { threadId: string }) {
  const { sendMessage } = useThreadStream({
    threadId,
    context: {
      mode: undefined,
      taskMode: "plan",
    },
    isMock: false,
  });
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        void sendMessage(threadId, { text: "plan this", files: [] });
      },
    },
    "submit",
  );
}

function SubmitAndMessagesHarness({ threadId }: { threadId: string }) {
  const { thread, sendMessage } = useThreadStream({
    threadId,
    context: { mode: undefined },
    isMock: false,
  });
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          void sendMessage(threadId, { text: "你能做什么", files: [] });
        },
      },
      "submit",
    ),
    React.createElement(
      "div",
      { "data-testid": "messages" },
      thread.messages.map((message) => visibleText(message)).join("|"),
    ),
  );
}

function QiongQiContextSubmitHarness({ threadId }: { threadId: string }) {
  const { sendMessage } = useThreadStream({
    threadId,
    context: {
      mode: undefined,
      taskMode: "plan",
      executionProfile: "deep",
      collaborationPolicy: "auto",
      workspaceRoot: "/Users/libing/project",
      approvalPolicy: "manual",
      sandboxMode: "danger-full-access",
      model_name: "minimax-m2",
    },
    isMock: false,
  });
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        void sendMessage(threadId, { text: "context payload", files: [] });
      },
    },
    "submit",
  );
}

function NewThreadSubmitHarness({ initialThreadId }: { initialThreadId: string }) {
  const [threadId, setThreadId] = React.useState(initialThreadId);
  const [isNewThread, setIsNewThread] = React.useState(true);
  const { thread, sendMessage } = useThreadStream({
    threadId: isNewThread ? undefined : threadId,
    context: { mode: undefined },
    isMock: false,
    onSend: (createdThreadId) => {
      setThreadId(createdThreadId);
      setIsNewThread(false);
    },
  });
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          void sendMessage(threadId, { text: "new thread message", files: [] });
        },
      },
      "submit",
    ),
    React.createElement(
      "div",
      { "data-testid": "messages" },
      thread.messages.map((message) => visibleText(message)).join("|"),
    ),
  );
}

function NewThreadFileSubmitHarness({
  initialThreadId,
}: {
  initialThreadId: string;
}) {
  const [threadId, setThreadId] = React.useState(initialThreadId);
  const [isNewThread, setIsNewThread] = React.useState(true);
  const { sendMessage } = useThreadStream({
    threadId: isNewThread ? undefined : threadId,
    context: { mode: undefined, workModeId: "task" },
    isMock: false,
    onSend: (createdThreadId) => {
      setThreadId(createdThreadId);
      setIsNewThread(false);
    },
    onStart: (createdThreadId) => {
      setThreadId(createdThreadId);
      setIsNewThread(false);
    },
  });
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        void sendMessage(threadId, {
          text: "create skill with docs",
          files: [
            {
              type: "file",
              filename: "skill-notes.md",
              mediaType: "text/markdown",
              url: "data:text/markdown;base64,bm90ZXM=",
            },
          ],
        });
      },
    },
    "submit",
  );
}

function StopHarness({ threadId }: { threadId: string }) {
  const { thread } = useThreadStream({
    threadId,
    context: { mode: undefined },
    isMock: false,
  });
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        void thread.stop();
      },
    },
    "stop",
  );
}

function RuntimeSnapshotHarness({ threadId }: { threadId: string }) {
  const snapshot = useThreadRuntimeSnapshot(threadId);
  return React.createElement(
    "div",
    { "data-testid": "runtime" },
    snapshot?.messages.map((message) => visibleText(message)).join("|") ??
      "empty",
  );
}

function StreamAndRuntimeHarness({ threadId }: { threadId: string }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Harness, { threadId }),
    React.createElement(RuntimeSnapshotHarness, { threadId }),
  );
}

function installLocalStorageStub() {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(() => {
        store.clear();
      }),
    },
  });
}

describe("useThreadStream cache bridge", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    installLocalStorageStub();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = undefined;
    container = undefined;
    streamState.messages = [];
    streamState.isLoading = false;
    queryState.data = [];
    fetchMock.mockReset();
    ensureThreadMock.mockReset();
    submitMock.mockReset();
    stopMock.mockReset();
    toastError.mockReset();
    streamOptions.current = undefined;
    window.localStorage.clear();
    clearThreadRuntimeSnapshot("thread-a");
    clearThreadRuntimeSnapshot("thread-b");
    vi.clearAllMocks();
  });

  test("refreshes restored cache when the thread id changes", () => {
    setCachedThreadState("thread-a", {
      messages: [
        {
          type: "human",
          id: "a-message",
          content: "上一条历史需求",
        },
      ],
      values: makeState(),
      isLoading: true,
      error: null,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(React.createElement(Harness, { threadId: "thread-a" }));
    });

    expect(container.textContent).toContain("上一条历史需求");

    act(() => {
      root!.render(React.createElement(Harness, { threadId: "thread-b" }));
    });

    expect(container.textContent).not.toContain("上一条历史需求");
  });

  test("does not auto-fetch run history when a task snapshot can restore the view", () => {
    queryState.data = [{ run_id: "run-a" }];
    setCachedThreadState("thread-a", {
      messages: [
        {
          type: "human",
          id: "a-message",
          content: "cached task state",
        },
      ],
      values: makeState(),
      isLoading: false,
      error: null,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(React.createElement(Harness, { threadId: "thread-a" }));
    });

    expect(container.textContent).toContain("cached task state");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("submits default QiongQi turns without legacy disconnect options", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(React.createElement(SubmitHarness, { threadId: "thread-a" }));
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    act(() => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const submitOptions = submitMock.mock.calls[0]?.[1] as
      | { onDisconnect?: string; context?: { is_plan_mode?: boolean } }
      | undefined;
    expect(submitOptions?.onDisconnect).toBeUndefined();
    expect(submitOptions?.context?.is_plan_mode).toBe(false);
  });

  test("submits plan mode through QiongQi context", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(PlanSubmitHarness, { threadId: "thread-a" }));
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const submitOptions = submitMock.mock.calls[0]?.[1] as
      | { context?: { is_plan_mode?: boolean } }
      | undefined;
    expect(submitOptions?.context?.is_plan_mode).toBe(true);
  });

  test("submits QiongQi execution context into the turn payload", async () => {
    submitMock.mockImplementation(async () => undefined);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(QiongQiContextSubmitHarness, {
          threadId: "thread-a",
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

    const submitOptions = submitMock.mock.calls[0]?.[1] as
      | { context?: Record<string, unknown> }
      | undefined;
    expect(submitOptions?.context).toMatchObject({
      taskMode: "plan",
      executionProfile: "deep",
      collaborationPolicy: "auto",
      workspaceRoot: "/Users/libing/project",
      approvalPolicy: "manual",
      sandboxMode: "danger-full-access",
      model_name: "minimax-m2",
      thinking_enabled: true,
      is_plan_mode: true,
      subagent_enabled: true,
      reasoning_effort: "high",
      thread_id: "thread-a",
    });
    expect(submitOptions?.context).not.toHaveProperty("orchestration_mode");
  });

  test("deduplicates optimistic user text after the server echoes the submitted human message", async () => {
    submitMock.mockImplementation(async () => undefined);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(SubmitAndMessagesHarness, { threadId: "thread-a" }),
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect((container.textContent?.match(/你能做什么/g) ?? [])).toHaveLength(1);

    streamState.messages = [
      {
        type: "human",
        id: "server-human",
        content: "你能做什么",
      },
      {
        type: "ai",
        id: "server-ai",
        content: "我可以帮你写代码。",
      },
    ];

    await act(async () => {
      root!.render(
        React.createElement(SubmitAndMessagesHarness, { threadId: "thread-a" }),
      );
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect((container.textContent?.match(/你能做什么/g) ?? [])).toHaveLength(1);
    expect(container.textContent).toContain("我可以帮你写代码。");
  });

  test("deduplicates echoed human messages when history and live stream use different ids", async () => {
    queryState.data = [makeRun("run-a", "success")];
    fetchMock.mockResolvedValue({
      json: async () => ({
        data: [
          {
            run_id: "run-a",
            content: {
              type: "human",
              id: "history-human",
              content: "你能做什么",
            },
            metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        hasMore: false,
      }),
    });
    streamState.messages = [
      {
        type: "human",
        id: "stream-human",
        content: "你能做什么",
      },
      {
        type: "ai",
        id: "stream-ai",
        content: "我可以帮你写代码。",
      },
    ];

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(Harness, { threadId: "thread-a" }));
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect((container.textContent?.match(/你能做什么/g) ?? [])).toHaveLength(1);
    expect(container.textContent).toContain("我可以帮你写代码。");
  });

  test("keeps the latest live stream message when repeated ids carry growing content", async () => {
    streamState.messages = [
      {
        type: "human",
        id: "stream-human-a",
        content: "Code review具体能做些什么",
      },
      {
        type: "human",
        id: "stream-human-b",
        content: "Code review具体能做些什么",
      },
      {
        type: "ai",
        id: "assistant-live",
        content: "计",
      },
      {
        type: "ai",
        id: "assistant-live",
        content: "计算\n\n- 数据结构选择",
      },
    ];

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(Harness, { threadId: "thread-a" }));
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      (container.textContent?.match(/Code review具体能做些什么/g) ?? []),
    ).toHaveLength(1);
    expect(container.textContent).not.toContain("计|计算");
    expect(container.textContent).toContain("计算");
    expect(container.textContent).toContain("数据结构选择");
  });

  test("keeps the optimistic user message visible when a new thread becomes active", async () => {
    submitMock.mockImplementation(async () => undefined);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(NewThreadSubmitHarness, {
          initialThreadId: "thread-a",
        }),
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("new thread message");
  });

  test("does not clear optimistic text when only hidden middleware messages arrive", async () => {
    submitMock.mockImplementation(async () => undefined);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(NewThreadSubmitHarness, {
          initialThreadId: "thread-a",
        }),
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("new thread message");

    streamState.messages = [
      {
        type: "human",
        id: "middleware-reminder",
        name: "dynamic_context_reminder",
        content: "<system-reminder>internal only</system-reminder>",
        additional_kwargs: {
          hide_from_ui: true,
          internal_middleware_message: "dynamic_context_reminder",
        },
      },
    ];

    await act(async () => {
      root!.render(
        React.createElement(NewThreadSubmitHarness, {
          initialThreadId: "thread-a",
        }),
      );
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("new thread message");
  });

  test("does not activate a new chat on the caller placeholder id before the stream returns the real thread id", async () => {
    const sendSpy = vi.fn();
    submitMock.mockImplementation(async () => undefined);

    function NewThreadOnSendHarness() {
      const [threadId, setThreadId] = React.useState("placeholder-thread");
      const [isNewThread, setIsNewThread] = React.useState(true);
      const { thread, sendMessage } = useThreadStream({
        threadId: isNewThread ? undefined : threadId,
        context: { mode: undefined },
        isMock: false,
        onSend: (createdThreadId) => {
          sendSpy(createdThreadId);
          setThreadId(createdThreadId);
          setIsNewThread(false);
        },
        onStart: (createdThreadId) => {
          setThreadId(createdThreadId);
          setIsNewThread(false);
        },
      });
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () => {
              void sendMessage(threadId, {
                text: "placeholder should not activate",
                files: [],
              });
            },
          },
          "submit",
        ),
        React.createElement(
          "div",
          { "data-testid": "messages" },
          thread.messages.map((message) => visibleText(message)).join("|"),
        ),
      );
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(NewThreadOnSendHarness));
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(sendSpy).not.toHaveBeenCalledWith("placeholder-thread");
    expect(container.textContent).toContain("placeholder should not activate");

    streamState.messages = [
      {
        type: "human",
        id: "server-user",
        content: "placeholder should not activate",
      },
      {
        type: "ai",
        id: "server-ai",
        content: "server step visible",
      },
    ];

    await act(async () => {
      streamOptions.current?.onThreadId?.("real-thread");
      await Promise.resolve();
      root!.render(React.createElement(NewThreadOnSendHarness));
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("server step visible");
  });

  test("creates a backend thread before uploading files for a new chat", async () => {
    const file = new File(["notes"], "skill-notes.md", {
      type: "text/markdown",
    });
    vi.mocked(promptInputFilePartToFile).mockResolvedValue(file);
    vi.mocked(uploadFiles).mockResolvedValue({
      success: true,
      message: "Uploaded 1 file",
      files: [
        {
          filename: "skill-notes.md",
          size: 5,
          path: "/data/threads/created-thread/uploads/skill-notes.md",
          virtual_path: "/mnt/qiongqi/uploads/skill-notes.md",
          artifact_url:
            "/api/threads/created-thread/artifacts/mnt/qiongqi/uploads/skill-notes.md",
        },
      ],
    });
    ensureThreadMock.mockResolvedValue("created-thread");
    submitMock.mockImplementation(async () => undefined);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        React.createElement(NewThreadFileSubmitHarness, {
          initialThreadId: "placeholder-thread",
        }),
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ensureThreadMock).toHaveBeenCalledWith(
      "placeholder-thread",
      expect.objectContaining({
        workModeId: "task",
        thread_id: "placeholder-thread",
      }),
    );
    expect(uploadFiles).toHaveBeenCalledWith("created-thread", [file]);
    expect(submitMock).toHaveBeenCalled();

    const ensureOrder = ensureThreadMock.mock.invocationCallOrder[0] ?? 0;
    const uploadOrder = vi.mocked(uploadFiles).mock.invocationCallOrder[0] ?? 0;
    const submitOrder = submitMock.mock.invocationCallOrder[0] ?? 0;
    expect(ensureOrder).toBeLessThan(uploadOrder);
    expect(uploadOrder).toBeLessThan(submitOrder);

    const submitOptions = submitMock.mock.calls[0]?.[1] as
      | { threadId?: string; context?: Record<string, unknown> }
      | undefined;
    expect(submitOptions?.threadId).toBe("created-thread");
    expect(submitOptions?.context?.thread_id).toBe("created-thread");
  });

  test("stop delegates active turn cancellation to the QiongQi stream", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(StopHarness, { threadId: "thread-a" }));
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stopMock).toHaveBeenCalled();
  });

  test("stop cleanup still runs if the local QiongQi stream stop fails", async () => {
    stopMock.mockRejectedValueOnce(new Error("local stream already closed"));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(React.createElement(StopHarness, { threadId: "thread-a" }));
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stopMock).toHaveBeenCalled();
    expect(window.localStorage.getItem("lg:stream:thread-a")).toBeNull();
  });

  test("clears stale stream reconnect keys without showing an error toast", () => {
    window.localStorage.setItem("lg:stream:thread-a", "run-a");

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(React.createElement(Harness, { threadId: "thread-a" }));
    });

    act(() => {
      streamOptions.current?.onError?.({
        status: 409,
        detail: "Run run-a is not active on this worker and cannot be streamed",
      });
    });

    expect(window.localStorage.getItem("lg:stream:thread-a")).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  test("publishes display snapshots to the workspace runtime store", () => {
    streamState.messages = [
      {
        type: "human",
        id: "live-message",
        content: "runtime bridge",
      },
    ];

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        React.createElement(StreamAndRuntimeHarness, { threadId: "thread-a" }),
      );
    });

    expect(container.textContent).toContain("runtime bridge");
  });
});
