// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CodeViewer } from "@/components/workspace/coding/code-viewer";

vi.mock("@/components/workspace/messages/markdown-content", () => ({
  MarkdownContent: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("@/components/workspace/copy-button", () => ({
  CopyButton: () => <button type="button">copy</button>,
}));

vi.mock("@/components/workspace/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/core/streamdown", () => ({
  streamdownPlugins: { rehypePlugins: [] },
}));

vi.mock("shiki", () => ({
  codeToHtml: vi.fn(() => new Promise<string>(() => undefined)),
}));

vi.mock("@/core/projects", () => ({
  useFileContent: () => ({
    isLoading: false,
    file: {
      path: "api/presenters.py",
      content: "def present(value):\n    return value\n",
      size: 40,
      language: "python",
    },
  }),
}));

describe("CodeViewer rendering", () => {
  afterEach(cleanup);

  test("keeps loaded source visible while syntax highlighting is pending", () => {
    render(<CodeViewer projectId="project-1" filePath="api/presenters.py" />);

    expect(screen.getByText(/def present\(value\):/)).toBeInTheDocument();
  });
});
