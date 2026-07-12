// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  ArtifactsProvider,
  useArtifacts,
} from "@/components/workspace/artifacts";
import { FinanceHtmlArtifactReader } from "@/components/workspace/finance/finance-html-artifact-reader";

const { previewSpy } = vi.hoisted(() => ({ previewSpy: vi.fn() }));

vi.mock("@/components/workspace/artifacts", async () =>
  vi.importActual("@/components/workspace/artifacts/context"),
);

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ setOpen: vi.fn() }),
}));

vi.mock("@/components/workspace/finance/finance-artifact-preview", () => ({
  FinanceArtifactPreview: ({
    filepath,
    onBack,
    threadId,
  }: {
    filepath: string;
    onBack: () => void;
    threadId: string;
  }) => {
    previewSpy({ filepath, threadId });
    return (
      <div data-testid="finance-preview">
        <span>{`${threadId}:${filepath}`}</span>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    );
  },
}));

function ArtifactHarness({ threadId }: { threadId: string }) {
  const { open, select, selectedArtifact, setOpen } = useArtifacts();

  const openArtifact = (filepath: string) => {
    select(filepath);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => openArtifact("reports/dashboard.html")}
      >
        Open HTML
      </button>
      <button type="button" onClick={() => openArtifact("reports/report.docx")}>
        Open Office
      </button>
      <output data-testid="artifact-state">
        {`${open ? "open" : "closed"}:${selectedArtifact ?? "none"}`}
      </output>
      <FinanceHtmlArtifactReader threadId={threadId} />
    </>
  );
}

function TestApp({ threadId }: { threadId: string }) {
  return (
    <ArtifactsProvider>
      <ArtifactHarness threadId={threadId} />
    </ArtifactsProvider>
  );
}

function MountReaderWithSelection() {
  const { select, setOpen } = useArtifacts();
  const [readerMounted, setReaderMounted] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          select("reports/dashboard.html");
          setOpen(true);
          setReaderMounted(true);
        }}
      >
        Mount reader
      </button>
      {readerMounted && <FinanceHtmlArtifactReader threadId="thread-1" />}
    </>
  );
}

describe("FinanceHtmlArtifactReader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  test("renders the selected HTML artifact for the active thread", () => {
    render(<TestApp threadId="thread-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Open HTML" }));

    expect(screen.getByTestId("finance-preview")).toHaveTextContent(
      "thread-1:reports/dashboard.html",
    );
  });

  test("preserves an open HTML selection on initial mount", () => {
    render(
      <ArtifactsProvider>
        <MountReaderWithSelection />
      </ArtifactsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mount reader" }));

    expect(screen.getByTestId("finance-preview")).toHaveTextContent(
      "thread-1:reports/dashboard.html",
    );
  });

  test("back deselects the artifact and closes its context", () => {
    render(<TestApp threadId="thread-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Open HTML" }));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.queryByTestId("finance-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("artifact-state")).toHaveTextContent(
      "closed:none",
    );
  });

  test("leaves non-HTML artifacts selected for the generic side panel", () => {
    render(<TestApp threadId="thread-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Open Office" }));

    expect(screen.queryByTestId("finance-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("artifact-state")).toHaveTextContent(
      "open:reports/report.docx",
    );
  });

  test("clears a stale HTML selection when the thread changes", async () => {
    const { rerender } = render(<TestApp threadId="thread-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Open HTML" }));
    expect(screen.getByTestId("finance-preview")).toBeInTheDocument();

    rerender(<TestApp threadId="thread-2" />);

    expect(screen.queryByTestId("finance-preview")).not.toBeInTheDocument();
    expect(previewSpy).not.toHaveBeenCalledWith({
      filepath: "reports/dashboard.html",
      threadId: "thread-2",
    });

    await waitFor(() => {
      expect(screen.getByTestId("artifact-state")).toHaveTextContent(
        "closed:none",
      );
    });
  });
});
