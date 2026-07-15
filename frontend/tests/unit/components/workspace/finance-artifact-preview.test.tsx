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

const liveFilepath =
  "write-file:reports/2026-07-10/dashboard.html?message_id=m&tool_call_id=c";
const liveProps = {
  ...baseProps,
  filepath: liveFilepath,
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
    expect(screen.getByRole("banner")).toHaveClass("h-11", "relative", "z-20");

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

  test("renders live HTML with a normalized filename and no Markdown toolbar action", async () => {
    const liveContent = "<html><body>live dashboard</body></html>";
    vi.mocked(useArtifactContent).mockReturnValue({
      ...hookResult,
      content: liveContent,
    });

    render(<FinanceArtifactPreview {...liveProps} />);

    expect(await screen.findByTitle("dashboard.html 金融看板")).toHaveAttribute(
      "src",
      "about:blank#dashboard",
    );
    expect(screen.getByText("dashboard.html")).toBeInTheDocument();
    expect(useArtifactContent).toHaveBeenCalledWith({
      enabled: false,
      filepath: liveFilepath,
      threadId: "thread-1",
    });
    const htmlBlob = vi.mocked(createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(await htmlBlob.text()).toBe(liveContent);

    expect(
      screen.queryByRole("button", { name: "下载 MD 报告" }),
    ).not.toBeInTheDocument();
  });

  test.each([
    {
      label: "empty",
      result: { ...hookResult, content: "" },
    },
    {
      label: "error",
      result: {
        ...hookResult,
        content: undefined,
        error: new Error("live content unavailable"),
      },
    },
  ])("does not offer HTML download for $label live content", ({ result }) => {
    vi.mocked(useArtifactContent).mockReturnValue(result);

    render(<FinanceArtifactPreview {...liveProps} />);

    expect(
      screen.queryByRole("button", { name: "下载 HTML" }),
    ).not.toBeInTheDocument();
    expect(urlOfArtifact).not.toHaveBeenCalledWith(
      expect.objectContaining({ filepath: liveFilepath }),
    );
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
    const firstButton = screen.getByRole("button", { name: "返回任务" });
    const iframe = screen.getByTitle("dashboard.html 金融看板");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(firstButton).toHaveFocus();
    expect(underlying.inert).toBe(true);
    expect(underlying).toHaveAttribute("aria-hidden", "true");

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(iframe).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(firstButton).toHaveFocus();

    unmount();
    expect(underlying.inert).toBe(false);
    expect(underlying).toHaveAttribute("aria-hidden", "false");
    expect(previousButton).toHaveFocus();
    underlying.remove();
  });

  test("keeps focus trapped when the dashboard is in an error state", async () => {
    vi.mocked(useArtifactContent).mockReturnValue({
      ...hookResult,
      content: undefined,
      error: new Error("network down"),
    });
    render(<FinanceArtifactPreview {...baseProps} />);
    const dialog = await screen.findByRole("dialog", {
      name: "金融结果预览",
    });
    const buttons = within(dialog).getAllByRole("button");
    const firstButton = screen.getByRole("button", { name: "返回任务" });
    const lastButton = buttons.at(-1);

    expect(lastButton).toBeDefined();
    lastButton?.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });

    expect(firstButton).toHaveFocus();
  });

  test("returns from the toolbar button and parent Escape key", () => {
    const onBack = vi.fn();
    render(<FinanceArtifactPreview {...baseProps} onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "返回任务" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onBack).toHaveBeenCalledTimes(2);
  });

  test("keeps the macOS titlebar draggable while excluding the back control from native drag hit-testing", () => {
    render(<FinanceArtifactPreview {...baseProps} />);

    expect(screen.getByRole("banner")).toHaveClass("desktop-titlebar-drag");
    const backButton = screen.getByRole("button", { name: "返回任务" });
    expect(backButton).toHaveClass("desktop-no-drag");
    expect(backButton).toHaveAttribute("data-desktop-no-drag", "true");
    expect(backButton.parentElement).toHaveClass("desktop-no-drag");
  });

  test("does not render a Markdown download action in the toolbar", () => {
    render(<FinanceArtifactPreview {...baseProps} />);
    expect(
      screen.queryByRole("button", { name: "下载 MD 报告" }),
    ).not.toBeInTheDocument();
    expect(downloadArtifactUrl).not.toHaveBeenCalled();
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
