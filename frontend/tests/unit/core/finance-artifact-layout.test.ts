import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("finance artifact layout", () => {
  test("finance renders selected HTML artifacts in its fullscreen reader", () => {
    const agentPanel = readFileSync(
      resolve(
        repoRoot,
        "src/components/workspace/finance/finance-agent-panel.tsx",
      ),
      "utf8",
    );

    expect(agentPanel).toContain("FinanceHtmlArtifactReader");
    expect(agentPanel).toContain("useArtifacts");
    expect(agentPanel).toContain("isHtmlArtifact(selectedArtifact)");
    expect(agentPanel).toContain("FinanceArtifactPreview");
    expect(agentPanel).toContain("onBack={deselect}");

    const threadProviderIndex = agentPanel.indexOf("<ThreadContext.Provider");
    const readerIndex = agentPanel.indexOf("<FinanceHtmlArtifactReader");
    const chatBoxIndex = agentPanel.indexOf("<ChatBox");

    expect(threadProviderIndex).toBeGreaterThanOrEqual(0);
    expect(readerIndex).toBeGreaterThan(threadProviderIndex);
    expect(chatBoxIndex).toBeGreaterThan(readerIndex);
    expect(agentPanel).toContain('artifactsMode="side-panel"');
  });

  test("office artifacts retain the generic side-panel renderer", () => {
    const chatBox = readFileSync(
      resolve(repoRoot, "src/components/workspace/chats/chat-box.tsx"),
      "utf8",
    );

    expect(chatBox).toContain('artifactsMode = "side-panel"');
    expect(chatBox).toContain("ResizablePanelGroup");
    expect(chatBox).toContain("ArtifactFileDetail");
    expect(chatBox).not.toContain("FinanceArtifactPreview");
  });
});
