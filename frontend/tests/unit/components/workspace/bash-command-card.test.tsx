// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { zhCN } from "@/core/i18n";

import { BashCommandCard } from "@/components/workspace/messages/bash-command-card";

describe("BashCommandCard", () => {
  const baseProps = {
    command: "npm run build",
    t: zhCN,
  };

  test("completed with output is collapsed, shows line count in header", () => {
    render(
      <BashCommandCard
        {...baseProps}
        status="completed"
        output={"> building\n✓ done\n✓ done2\n✓ done3"}
      />,
    );
    expect(
      screen.getByText((_, node) =>
        node?.tagName === "PRE" && node.textContent === "$ npm run build",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/4 行输出/)).toBeInTheDocument();
    // output body hidden when collapsed
    expect(screen.queryByText("> building")).not.toBeInTheDocument();
  });

  test("completed with no output shows no-output label and no expand", () => {
    render(<BashCommandCard {...baseProps} status="completed" output="" />);
    expect(screen.getByText(/无输出/)).toBeInTheDocument();
  });

  test("running auto-expands and shows live output + running label", () => {
    render(
      <BashCommandCard
        {...baseProps}
        status="running"
        output="partial line"
      />,
    );
    expect(screen.getByText(/运行中/)).toBeInTheDocument();
    expect(screen.getByText("partial line")).toBeInTheDocument();
  });

  test("failed auto-expands and shows exit code", () => {
    render(
      <BashCommandCard
        {...baseProps}
        status="failed"
        exitCode={1}
        output="Error: boom"
      />,
    );
    expect(screen.getByText(/失败/)).toBeInTheDocument();
    expect(screen.getByText(/退出码 1/)).toBeInTheDocument();
    expect(screen.getByText("Error: boom")).toBeInTheDocument();
  });

  test("clicking the header toggles collapse on completed", () => {
    render(
      <BashCommandCard
        {...baseProps}
        status="completed"
        output={"line1\nline2\nline3"}
      />,
    );
    expect(screen.queryByText("line1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/3 行输出/));
    expect(screen.getByText("line1")).toBeInTheDocument();
  });

  test("renders approve/deny buttons when approval is pending", () => {
    const onApprove = vi.fn();
    render(
      <BashCommandCard
        {...baseProps}
        status="pending"
        approval={{ approvalId: "ap_1", status: "pending", summary: "run it" }}
        onApprove={onApprove}
      />,
    );
    fireEvent.click(screen.getByText("允许"));
    expect(onApprove).toHaveBeenCalledWith("ap_1");
  });

  test("denied approval shows denied label", () => {
    render(
      <BashCommandCard
        {...baseProps}
        status="completed"
        approval={{ approvalId: "ap_1", status: "denied", summary: "no" }}
      />,
    );
    expect(screen.getByText(/已拒绝/)).toBeInTheDocument();
  });
});
