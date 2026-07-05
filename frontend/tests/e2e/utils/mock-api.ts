/**
 * Shared mock helpers for E2E tests.
 *
 * Intercepts all Agent runtime / Backend API endpoints so tests can run without
 * a real backend.  Each test file imports `mockRuntimeAPI` and
 * `handleRunStream` from here.
 */

import type { Page, Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants — deterministic IDs used across tests
// ---------------------------------------------------------------------------

export const MOCK_THREAD_ID = "00000000-0000-0000-0000-000000000001";
export const MOCK_THREAD_ID_2 = "00000000-0000-0000-0000-000000000002";
export const MOCK_RUN_ID = "00000000-0000-0000-0000-000000000099";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MockThread = {
  thread_id: string;
  title?: string;
  updated_at?: string;
  workModeId?: string;
  workspaceRoot?: string;
  todos?: Array<{
    id?: string;
    content: string;
    status?: "pending" | "in_progress" | "completed";
  }>;
};

export type MockProject = {
  id: string;
  name: string;
  path: string;
  description?: string;
  is_git_repo?: boolean;
};

export type MockModel = {
  id: string;
  name: string;
  use: string;
  model: string;
  display_name: string;
  supports_thinking?: boolean;
  supports_vision?: boolean;
};

export type MockAPIOptions = {
  threads?: MockThread[];
  projects?: MockProject[];
  models?: MockModel[];
};

// ---------------------------------------------------------------------------
// mockRuntimeAPI
// ---------------------------------------------------------------------------

/**
 * Mock all Agent runtime API endpoints that the frontend calls on page load and
 * during message sending.  Without these mocks the pages would hang waiting
 * for a real backend.
 */
export function mockRuntimeAPI(page: Page, options?: MockAPIOptions) {
  const threads = options?.threads ?? [];
  const projects = options?.projects ?? [];
  const models = options?.models ?? [];
  const modelProfiles = Object.fromEntries(
    models.map((model) => [
      model.display_name ?? model.name ?? model.id,
      {
        providerModel: model.model,
        provider: model.use,
        supportsThinking: model.supports_thinking ?? false,
        supportsVision: model.supports_vision ?? false,
      },
    ]),
  );

  void page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "e2e-user",
        email: "e2e@test.local",
        system_role: "admin",
        needs_setup: false,
      }),
    }),
  );

  void page.route("**/api/v1/auth/setup-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ needs_setup: false }),
    }),
  );

  void page.route("**/api/v1/auth/logout", (route) =>
    route.fulfill({
      status: 204,
      body: "",
    }),
  );

  void page.route("**/api/usage?group_by=thread", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    }),
  );

  void page.route("**/api/work-modes", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          defaultModeId: "task",
          lockedSkillIds: [],
          workModes: [
            {
              id: "task",
              name: "日常办公",
              description: "General task mode",
              icon: "briefcase",
              builtin: true,
              editable: false,
              skills: [],
            },
          ],
        }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/config", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          config: {
            serve: {
              model: models[0]?.display_name ?? models[0]?.name ?? "",
            },
            models: {
              profiles: modelProfiles,
            },
          },
        }),
      });
    }
    return route.fallback();
  });

  void page.route(/\/v1\/threads(?:\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          threads: threads.map((t) => ({
            id: t.thread_id,
            title: t.title ?? "Untitled",
            workspace: t.workspaceRoot ?? "/tmp/kworks",
            model: "test-model",
            mode: "agent",
            workModeId: t.workModeId ?? "task",
            status: "idle",
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: t.updated_at ?? "2025-01-01T00:00:00Z",
          })),
        }),
      });
    }
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          threadToQiongqiRecord({
            thread_id: MOCK_THREAD_ID,
            title: "Untitled",
            workModeId: "task",
          }),
        ),
      });
    }
    return route.fallback();
  });

  void page.route(/\/v1\/threads\/([^/?]+)(?:\?|$)/, (route) => {
    const url = route.request().url();
    const threadId = decodeURIComponent(
      new URL(url).pathname.split("/").at(-1) ?? "",
    );
    const matchingThread = threads.find((t) => t.thread_id === threadId);

    if (route.request().method() === "GET" && matchingThread) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(threadToQiongqiRecord(matchingThread)),
      });
    }
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        status: matchingThread ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(
          matchingThread
            ? threadToQiongqiRecord(matchingThread)
            : { detail: "Thread not found" },
        ),
      });
    }
    if (route.request().method() === "DELETE") {
      return route.fulfill({ status: 204, body: "" });
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Thread not found" }),
    });
  });

  // QiongQi runtime SSE — chat pages subscribe on mount. Without this mock,
  // production E2E navigation can leak through Next rewrites to the default
  // gateway port and trip the global error boundary while leaving chat mode.
  void page.route(/\/v1\/threads\/([^/]+)\/events(?:\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "",
      });
    }
    return route.fallback();
  });

  // Thread search — sidebar thread list & chats list page
  void page.route("**/api/threads/search", (route) => {
    const body = threads.map((t) => ({
      thread_id: t.thread_id,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: t.updated_at ?? "2025-01-01T00:00:00Z",
      metadata: {},
      status: "idle",
      values: { title: t.title ?? "Untitled" },
      context: {
        workModeId: t.workModeId ?? "task",
        ...(t.workspaceRoot ? { workspaceRoot: t.workspaceRoot } : {}),
      },
    }));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  // Thread create — called when user sends first message in a new chat
  void page.route("**/api/threads", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          thread_id: MOCK_THREAD_ID,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {},
          status: "idle",
          values: {},
        }),
      });
    }
    return route.fallback();
  });

  // Thread update (PATCH) — metadata update after creation
  void page.route("**/api/threads/*", (route) => {
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ thread_id: MOCK_THREAD_ID }),
      });
    }
    return route.fallback();
  });

  // Thread history — qiongqi stream fetches state history on mount
  void page.route("**/api/threads/*/history", (route) => {
    const url = route.request().url();

    // For threads that exist in our mock data, return history with messages
    const matchingThread = threads.find((t) => url.includes(t.thread_id));
    if (matchingThread) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            values: {
              title: matchingThread.title ?? "Untitled",
              todos: matchingThread.todos ?? [],
              messages: [
                {
                  type: "human",
                  id: `msg-human-${matchingThread.thread_id}`,
                  content: [{ type: "text", text: "Previous question" }],
                },
                {
                  type: "ai",
                  id: `msg-ai-${matchingThread.thread_id}`,
                  content: `Response in thread ${matchingThread.title ?? matchingThread.thread_id}`,
                },
              ],
            },
            next: [],
            metadata: {},
            created_at: "2025-01-01T00:00:00Z",
            parent_config: null,
          },
        ]),
      });
    }

    // New threads — empty history
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  // Thread state — getState for individual thread
  void page.route("**/api/threads/*/state", (route) => {
    if (route.request().method() === "GET") {
      const url = route.request().url();
      const matchingThread = threads.find((t) => url.includes(t.thread_id));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          values: {
            title: matchingThread?.title ?? "Untitled",
            todos: matchingThread?.todos ?? [],
            messages: matchingThread
              ? [
                  {
                    type: "human",
                    id: `msg-human-${matchingThread.thread_id}`,
                    content: [{ type: "text", text: "Previous question" }],
                  },
                  {
                    type: "ai",
                    id: `msg-ai-${matchingThread.thread_id}`,
                    content: `Response in thread ${matchingThread.title ?? matchingThread.thread_id}`,
                  },
                ]
              : [],
          },
          next: [],
          metadata: {},
          created_at: "2025-01-01T00:00:00Z",
        }),
      });
    }
    return route.fallback();
  });

  // The URL carries a query string (e.g. `?limit=10&offset=0`), which Playwright
  // glob `*` does NOT cross, so we match with a regex anchored to `/runs`
  // followed by `?` or end-of-string.  This must NOT match `/runs/stream`.
  void page.route(/\/api\/threads\/[^/]+\/runs(\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    }
    return route.fallback();
  });

  // Run stream — returns a minimal SSE response with an AI message
  void page.route("**/api/runs/stream", handleRunStream);
  void page.route("**/api/threads/*/runs/stream", handleRunStream);

  void page.route(/\/api\/projects(?:\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projects: projects.map(mockProjectToApiProject),
        }),
      });
    }
    return route.fallback();
  });

  void page.route(/\/api\/projects\/([^/?/]+)(?:\?|$)/, (route) => {
    const projectId = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").at(-1) ?? "",
    );
    const project = projects.find((item) => item.id === projectId);
    if (route.request().method() === "GET" && project) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockProjectToApiProject(project)),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Project not found" }),
    });
  });

  void page.route(/\/api\/projects\/([^/]+)\/worktrees(?:\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ worktrees: [] }),
      });
    }
    return route.fallback();
  });

  void page.route(/\/api\/projects\/([^/]+)\/diff(?:\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_git_repo: false,
          has_changes: false,
          files: [],
          diff: "",
        }),
      });
    }
    return route.fallback();
  });

  void page.route(/\/api\/projects\/([^/]+)\/environment(?:\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_git_repo: false,
          branch: null,
          head: null,
          upstream: null,
          ahead: 0,
          behind: 0,
          changed_files: 0,
          additions: 0,
          deletions: 0,
          github_cli: {
            available: false,
            authenticated: false,
            username: null,
            host: null,
            detail: null,
          },
          source: {
            label: "local",
            remote: null,
            provider: "local",
          },
        }),
      });
    }
    return route.fallback();
  });

  void page.route(/\/api\/projects\/([^/]+)\/files(?:\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entries: [] }),
      });
    }
    return route.fallback();
  });

  void page.route(
    /\/api\/coding\/sessions\/([^/]+)\/changes(?:\?|$)/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ thread_id: "mock", changes: [] }),
      }),
  );

  void page.route(/\/api\/coding\/sessions\/([^/]+)\/review(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ thread_id: "mock", review: null }),
    }),
  );

  void page.route(/\/api\/coding\/sessions\/([^/]+)\/events(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ thread_id: "mock", events: [] }),
    }),
  );

  void page.route(
    /\/api\/coding\/sessions\/([^/]+)\/roi\/summary(?:\?|$)/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          thread_id: "mock",
          summary: null,
        }),
      }),
  );

  void page.route(/\/api\/coding\/sessions\/([^/]+)\/roi(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ thread_id: "mock", reports: [] }),
    }),
  );

  void page.route(/\/api\/coding\/skills(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ skills: [] }),
    }),
  );

  void page.route(/\/api\/coding\/delivery-stages(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stages: [] }),
    }),
  );

  void page.route(/\/api\/coding\/stage(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        project_root: "/tmp/coding-project",
        current_stage: null,
        stage_history: [],
        pending_suggestion: null,
        updated_at: null,
      }),
    }),
  );

  // Models list — model picker dropdown
  void page.route("**/api/models", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models,
          token_usage: { enabled: false },
        }),
      });
    }
    return route.fallback();
  });

}

// ---------------------------------------------------------------------------
// handleRunStream
// ---------------------------------------------------------------------------

/**
 * Build a minimal SSE stream that the stream hook can parse.
 * The stream returns a single AI message: "Hello from KWorks!".
 */
export function handleRunStream(route: Route) {
  const events = [
    {
      event: "metadata",
      data: { run_id: MOCK_RUN_ID, thread_id: MOCK_THREAD_ID },
    },
    {
      event: "values",
      data: {
        messages: [
          {
            type: "human",
            id: "msg-human-1",
            content: [{ type: "text", text: "Hello" }],
          },
          {
            type: "ai",
            id: "msg-ai-1",
            content: "Hello from KWorks!",
          },
        ],
      },
    },
    { event: "end", data: {} },
  ];

  const body = events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");

  return route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body,
  });
}

function threadToQiongqiRecord(thread: MockThread) {
  const title = thread.title ?? "Untitled";
  const createdAt = "2025-01-01T00:00:00Z";
  const updatedAt = thread.updated_at ?? createdAt;
  return {
    id: thread.thread_id,
    title,
    workspace: thread.workspaceRoot ?? "/tmp/kworks",
    model: "test-model",
    mode: "agent",
    workModeId: thread.workModeId ?? "task",
    status: "idle",
    createdAt,
    updatedAt,
    turns: [
      {
        id: `turn-${thread.thread_id}`,
        threadId: thread.thread_id,
        status: "completed",
        prompt: "Previous question",
        createdAt,
        startedAt: createdAt,
        finishedAt: updatedAt,
        items: [
          {
            id: `msg-human-${thread.thread_id}`,
            kind: "user_message",
            text: "Previous question",
            displayText: "Previous question",
            createdAt,
          },
          {
            id: `msg-ai-${thread.thread_id}`,
            kind: "assistant_text",
            text: `Response in thread ${title}`,
            createdAt: updatedAt,
          },
          ...(thread.todos?.length
            ? [
                {
                  id: `tool-todo-${thread.thread_id}`,
                  kind: "tool_call",
                  toolName: "todo_write",
                  callId: `call-todo-${thread.thread_id}`,
                  toolKind: "tool_call",
                  arguments: { todos: thread.todos },
                  summary: "更新任务步骤",
                  createdAt: updatedAt,
                },
              ]
            : []),
        ],
      },
    ],
  };
}

function mockProjectToApiProject(project: MockProject) {
  const createdAt = "2025-01-01T00:00:00Z";
  return {
    id: project.id,
    name: project.name,
    path: project.path,
    description: project.description ?? "",
    config: {},
    is_git_repo: project.is_git_repo ?? false,
    created_at: createdAt,
    updated_at: createdAt,
  };
}
