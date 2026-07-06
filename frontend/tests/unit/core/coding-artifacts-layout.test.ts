import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("coding artifacts layout", () => {
  test("coding agent panel disables the generic chat artifact side panel", () => {
    const agentPanel = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/agent-panel.tsx"),
      "utf8",
    );

    expect(agentPanel).toContain('artifactsMode="disabled"');
  });

  test("coding workbench owns artifact state", () => {
    const workbench = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/coding-workbench.tsx"),
      "utf8",
    );

    expect(workbench).toContain("ArtifactsProvider");
    expect(workbench).toContain('aria-label="代码区视图"');
  });

  test("artifact preview dependencies tolerate missing thread context", () => {
    const artifactHooks = readFileSync(
      resolve(repoRoot, "src/core/artifacts/hooks.ts"),
      "utf8",
    );
    const codeEditor = readFileSync(
      resolve(repoRoot, "src/components/workspace/code-editor.tsx"),
      "utf8",
    );

    expect(artifactHooks).toContain("useOptionalThread");
    expect(artifactHooks).toContain("threadContext?.thread");
    expect(codeEditor).toContain("useOptionalThread");
    expect(codeEditor).toContain("threadContext?.thread.isLoading ?? false");
  });

  test("chat box never writes undefined artifacts into context", () => {
    const chatBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/chats/chat-box.tsx"),
      "utf8",
    );

    // The result-file list is derived from write/edit tool calls (always a
    // string[]), never undefined. Guard against regressions that reintroduce
    // an unguarded thread.values.artifacts write.
    expect(chatBox).toContain("collectResultFiles(thread.messages)");
    expect(chatBox).not.toContain("setArtifacts(thread.values.artifacts)");
  });

  test("input box surfaces result files above the composer with preview and download actions", () => {
    const inputBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/input-box.tsx"),
      "utf8",
    );
    const resultStrip = readFileSync(
      resolve(
        repoRoot,
        "src/components/workspace/artifacts/artifact-result-strip.tsx",
      ),
      "utf8",
    );

    expect(inputBox).toContain("<ArtifactResultStrip");
    expect(inputBox.indexOf("<ArtifactResultStrip")).toBeLessThan(
      inputBox.indexOf("<PromptInput"),
    );
    expect(resultStrip).toContain("useArtifacts");
    expect(resultStrip).toContain("select(filepath)");
    expect(resultStrip).toContain("setOpen(true)");
    expect(resultStrip).toContain("downloadArtifactUrl");
  });

  test("coding agent panel does not create a nested artifacts provider", () => {
    const agentPanel = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/agent-panel.tsx"),
      "utf8",
    );

    expect(agentPanel).not.toContain("<ArtifactsProvider>");
  });

  test("coding agent panel refreshes project files after file-related agent activity", () => {
    const agentPanel = readFileSync(
      resolve(repoRoot, "src/components/workspace/coding/agent-panel.tsx"),
      "utf8",
    );

    expect(agentPanel).toContain("useQueryClient");
    expect(agentPanel).toContain("refreshProjectFiles");
    expect(agentPanel).toContain('queryKey: ["projects", projectId, "files"]');
    expect(agentPanel).toContain('queryKey: ["projects", projectId, "file"]');
    expect(agentPanel).toContain("onToolEnd:");
    expect(agentPanel).toContain("isFileMutationTool");
    expect(agentPanel).toContain("onFinish:");
  });

  test("chat box supports a disabled artifact mode without resizing the chat area", () => {
    const chatBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/chats/chat-box.tsx"),
      "utf8",
    );

    expect(chatBox).toContain('artifactsMode = "side-panel"');
    expect(chatBox).toContain('artifactsMode === "disabled"');
    expect(chatBox).toContain("return <>{children}</>;");
  });
});
