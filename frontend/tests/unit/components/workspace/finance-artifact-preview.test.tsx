// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { FinanceArtifactPreview } from "@/components/workspace/finance/finance-artifact-preview";
import { downloadArtifactUrl } from "@/core/artifacts/authenticated-url";
import { useArtifactContent } from "@/core/artifacts/hooks";
import { urlOfArtifact } from "@/core/artifacts/utils";

vi.mock("@/core/artifacts/authenticated-url", () => ({
  downloadArtifactUrl: vi.fn(),
}));

vi.mock("@/core/artifacts/hooks", () => ({
  useArtifactContent: vi.fn(),
}));

vi.mock("@/core/artifacts/utils", () => ({
  urlOfArtifact: vi.fn(
    ({ filepath, threadId, download }) =>
      `/artifact/${threadId}/${filepath}${download ? "?download=true" : ""}`,
  ),
}));

const hookResult = {
  content: "<html><body>dashboard</body></html>",
  url: undefined,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

const baseProps = {
  artifacts: [
    "reports/2026-07-10/dashboard.html",
    "reports/2026-07-10/daily_report.md",
    "reports/2026-07-10/AUDIT.md",
  ],
  filepath: "reports/2026-07-10/dashboard.html",
  threadId: "thread-1",
  onBack: vi.fn(),
};

describe("FinanceArtifactPreview", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useArtifactContent).mockReturnValue({ ...hookResult });
    createObjectURL = vi.fn(() => "about:blank#dashboard");
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("portals a fixed fullscreen layer and renders HTML in a restricted iframe", async () => {
    render(<FinanceArtifactPreview {...baseProps} />);

    const preview = screen.getByTestId("finance-artifact-preview");
    expect(preview.parentElement).toBe(document.body);
    expect(preview).toHaveAttribute("aria-label", "金融结果预览");
    expect(preview).toHaveClass("fixed", "inset-0", "z-[100]");
    expect(screen.getByRole("banner")).toHaveClass("h-11");

    const iframe = await screen.findByTitle("dashboard.html 金融看板");
    expect(iframe).toHaveAttribute("src", "about:blank#dashboard");
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-forms");
    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: "text/html;charset=utf-8" }),
    );
    expect(useArtifactContent).toHaveBeenCalledWith({
      enabled: true,
      filepath: baseProps.filepath,
      threadId: baseProps.threadId,
    });
  });

  test("renders no overlay during server rendering", () => {
    expect(renderToString(<FinanceArtifactPreview {...baseProps} />)).toBe("");
    expect(
      screen.queryByTestId("finance-artifact-preview"),
    ).not.toBeInTheDocument();
  });

  test("isolates dialog focus and restores the underlying page on unmount", async () => {
    const underlying = document.createElement("main");
    const previousButton = document.createElement("button");
    previousButton.textContent = "Previous action";
    underlying.setAttribute("aria-hidden", "false");
    underlying.appendChild(previousButton);
    document.body.appendChild(underlying);
    previousButton.focus();

    const { unmount } = render(<FinanceArtifactPreview {...baseProps} />);
    const dialog = await screen.findByRole("dialog", {
      name: "金融结果预览",
    });
    const dialogButtons = within(dialog).getAllByRole("button");
    const firstButton = screen.getByRole("button", { name: "返回任务" });
    const lastButton = dialogButtons.at(-1);

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(firstButton).toHaveFocus();
    expect(underlying.inert).toBe(true);
    expect(underlying).toHaveAttribute("aria-hidden", "true");

    expect(lastButton).toBeDefined();
    lastButton?.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(firstButton).toHaveFocus();

    unmount();
    expect(underlying.inert).toBe(false);
    expect(underlying).toHaveAttribute("aria-hidden", "false");
    expect(previousButton).toHaveFocus();
    underlying.remove();
  });

  test("returns from the toolbar button and parent Escape key", () => {
    const onBack = vi.fn();
    render(<FinanceArtifactPreview {...baseProps} onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "返回任务" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onBack).toHaveBeenCalledTimes(2);
  });

  test("downloads the preferred daily Markdown report", async () => {
    render(<FinanceArtifactPreview {...baseProps} />);

    const button = screen.getByRole("button", { name: "下载 MD 报告" });
    expect(button).toHaveAttribute("title", "下载 daily_report.md");
    fireEvent.click(button);

    await waitFor(() => {
      expect(urlOfArtifact).toHaveBeenCalledWith({
        filepath: "reports/2026-07-10/daily_report.md",
        threadId: "thread-1",
        download: true,
      });
      expect(downloadArtifactUrl).toHaveBeenCalledWith(
        "/artifact/thread-1/reports/2026-07-10/daily_report.md?download=true",
        "daily_report.md",
      );
    });
  });

  test("disables Markdown download when no report exists", () => {
    render(
      <FinanceArtifactPreview
        {...baseProps}
        artifacts={[baseProps.filepath]}
      />,
    );

    const button = screen.getByRole("button", { name: "下载 MD 报告" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "未找到 Markdown 报告");
  });

  test("renders the loading state", () => {
    vi.mocked(useArtifactContent).mockReturnValue({
      ...hookResult,
      content: undefined,
      isLoading: true,
    });

    render(<FinanceArtifactPreview {...baseProps} />);

    expect(screen.getByText("正在加载金融看板...")).toBeInTheDocument();
  });

  test("shows load errors, retries, and offers HTML download", async () => {
    const refetch = vi.fn();
    vi.mocked(useArtifactContent).mockReturnValue({
      ...hookResult,
      content: undefined,
      error: new Error("network down"),
      refetch,
    });

    render(<FinanceArtifactPreview {...baseProps} />);

    expect(screen.getByText("金融看板加载失败")).toBeInTheDocument();
    expect(screen.getByText("network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(refetch).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "下载 HTML" }));
    await waitFor(() => {
      expect(downloadArtifactUrl).toHaveBeenCalledWith(
        "/artifact/thread-1/reports/2026-07-10/dashboard.html?download=true",
        "dashboard.html",
      );
    });
  });

  test("shows empty content and reports HTML download failures", async () => {
    const downloadError = vi.spyOn(toast, "error");
    vi.mocked(downloadArtifactUrl).mockRejectedValueOnce(new Error("denied"));
    vi.mocked(useArtifactContent).mockReturnValue({
      ...hookResult,
      content: "",
    });

    render(<FinanceArtifactPreview {...baseProps} />);

    expect(screen.getByText("文件内容为空")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "下载 HTML" }));
    await waitFor(() => {
      expect(downloadError).toHaveBeenCalledWith("HTML 看板下载失败");
    });
    expect(screen.getByTestId("finance-artifact-preview")).toBeInTheDocument();
  });

  test("prevents duplicate Markdown downloads while pending and reports failure", async () => {
    let rejectDownload: (reason: Error) => void = () => undefined;
    const pending = new Promise<void>((_resolve, reject) => {
      rejectDownload = reject;
    });
    const downloadError = vi.spyOn(toast, "error");
    vi.mocked(downloadArtifactUrl).mockReturnValueOnce(pending);

    render(<FinanceArtifactPreview {...baseProps} />);

    const button = screen.getByRole("button", { name: "下载 MD 报告" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(downloadArtifactUrl).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    rejectDownload(new Error("denied"));
    await waitFor(() => {
      expect(downloadError).toHaveBeenCalledWith("Markdown 报告下载失败");
    });
    expect(screen.getByTestId("finance-artifact-preview")).toBeInTheDocument();
  });

  test("revokes HTML object URLs on content change and unmount", async () => {
    createObjectURL
      .mockReturnValueOnce("about:blank#first")
      .mockReturnValueOnce("about:blank#second");
    const { rerender, unmount } = render(
      <FinanceArtifactPreview {...baseProps} />,
    );

    vi.mocked(useArtifactContent).mockReturnValue({
      ...hookResult,
      content: "<html><body>updated</body></html>",
    });
    rerender(<FinanceArtifactPreview {...baseProps} />);

    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("about:blank#first");
    });
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("about:blank#second");
  });
});
