// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CodingErrorBoundary } from "@/components/workspace/coding/coding-error-boundary";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function BrokenChild(): React.ReactElement {
  throw new Error("coding render exploded");
}

describe("CodingErrorBoundary", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
    vi.restoreAllMocks();
  });

  test("keeps the coding workbench mounted when a child render fails", () => {
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        React.createElement(
          CodingErrorBoundary,
          { label: "消息区域", onError },
          React.createElement(BrokenChild),
        ),
      );
    });

    expect(container.textContent).toContain("消息区域暂时不可用");
    expect(container.textContent).toContain("重试");
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("coding render exploded"),
    );
  });
});
