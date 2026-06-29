import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultKWorksWorkspaceDataDir,
  kworksUserWorkspacePaths,
  qiongqiConfigFromLaunchConfig,
  qiongqiStorageBackend,
  resolveKWorksWorkspaceRoot,
  resolveQiongqiLaunchConfig,
} from "../dist/qiongqi-launch-config.js";

test("resolves KWorks workspace data directories under the user home", () => {
  assert.equal(
    defaultKWorksWorkspaceDataDir({ HOME: "/Users/tester" }, "desktop"),
    "/Users/tester/.kworks-workspace",
  );
  assert.equal(
    defaultKWorksWorkspaceDataDir({ HOME: "/Users/tester" }, "web"),
    "/Users/tester/.kworks-workspace-web",
  );
  assert.equal(
    defaultKWorksWorkspaceDataDir({ USERPROFILE: "C:\\Users\\tester" }, "desktop"),
    "C:\\Users\\tester/.kworks-workspace",
  );
  assert.equal(
    resolveKWorksWorkspaceRoot({ HOME: "/Users/tester" }, "web"),
    "/Users/tester/.kworks-workspace-web",
  );
  assert.equal(
    resolveKWorksWorkspaceRoot({ HOME: "/Users/tester", KWORKS_WORKSPACE_DIR: "/custom/kworks" }, "desktop"),
    "/custom/kworks",
  );
});

test("creates per-user KWorks workspace subdirectories for data and capabilities", () => {
  assert.deepEqual(kworksUserWorkspacePaths("/Users/tester/.kworks-workspace", "user:123"), {
    root: "/Users/tester/.kworks-workspace",
    userRoot: "/Users/tester/.kworks-workspace/users/user_123",
    data: "/Users/tester/.kworks-workspace/users/user_123/data",
    thread: "/Users/tester/.kworks-workspace/users/user_123/thread",
    threads: "/Users/tester/.kworks-workspace/users/user_123/threads",
    workspace: "/Users/tester/.kworks-workspace/users/user_123/workspace",
    memory: "/Users/tester/.kworks-workspace/users/user_123/memory",
    secrets: "/Users/tester/.kworks-workspace/users/user_123/secrets",
    usage: "/Users/tester/.kworks-workspace/users/user_123/usage",
    skills: "/Users/tester/.kworks-workspace/users/user_123/skills",
    mcp: "/Users/tester/.kworks-workspace/users/user_123/mcp",
    tools: "/Users/tester/.kworks-workspace/users/user_123/tools",
    automations: "/Users/tester/.kworks-workspace/users/user_123/automations",
    artifacts: "/Users/tester/.kworks-workspace/users/user_123/artifacts",
    attachments: "/Users/tester/.kworks-workspace/users/user_123/attachments",
    logs: "/Users/tester/.kworks-workspace/users/user_123/logs",
  });
});

test("environment credentials provide explicit QiongQi bootstrap launches", () => {
  const resolved = resolveQiongqiLaunchConfig({
      env: {
        QIONGQI_MODEL: "explicit-model",
        QIONGQI_BASE_URL: "https://explicit.example/v1",
        QIONGQI_API_KEY: "sk-explicit",
      },
    });
  assert.deepEqual({
    model: resolved.model,
    baseUrl: resolved.baseUrl,
    apiKey: resolved.apiKey,
    source: resolved.source,
    models: resolved.models,
  }, {
    model: "explicit-model",
    baseUrl: "https://explicit.example/v1",
    apiKey: "sk-explicit",
    source: "environment",
    models: [],
  });
});

test("QiongQi launch config starts empty without environment credentials", () => {
  const launchConfig = resolveQiongqiLaunchConfig({
    env: {},
  });

  const qiongqiConfig = qiongqiConfigFromLaunchConfig(launchConfig);
  assert.deepEqual(qiongqiConfig, {
    serve: {
      baseUrl: "https://api.deepseek.com",
      apiKey: "",
    },
    models: {
      profiles: {},
    },
  });
});

test("QiongQi storage defaults to file unless hybrid is explicitly requested", () => {
  assert.equal(qiongqiStorageBackend({}), "file");
  assert.equal(qiongqiStorageBackend({ QIONGQI_STORAGE_BACKEND: "file" }), "file");
  assert.equal(qiongqiStorageBackend({ QIONGQI_STORAGE_BACKEND: "hybrid" }), "hybrid");
});
