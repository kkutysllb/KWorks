// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";

import {
  canNavigateWorkspaceInPlace,
  navigateWorkspaceInPlace,
  WORKSPACE_ROUTE_CHANGE_EVENT,
} from "@/core/navigation/workspace-route";

describe("workspace in-place navigation", () => {
  test("keeps chat thread switches inside the existing chat shell", () => {
    expect(
      canNavigateWorkspaceInPlace(
        "/workspace/chats/thread-a",
        "/workspace/chats/thread-b",
      ),
    ).toBe(true);
    expect(
      canNavigateWorkspaceInPlace(
        "/workspace/chats/new",
        "/workspace/chats/thread-b?mock=true",
      ),
    ).toBe(true);
  });

  test("keeps coding task switches in place only within the same project shell", () => {
    expect(
      canNavigateWorkspaceInPlace(
        "/workspace/coding/project-a?thread=old",
        "/workspace/coding/project-a?thread=new",
      ),
    ).toBe(true);
    expect(
      canNavigateWorkspaceInPlace(
        "/workspace/coding/project-a",
        "/workspace/coding/project-b?thread=new",
      ),
    ).toBe(false);
  });

  test("does not fake in-place navigation across different workspace surfaces", () => {
    expect(
      canNavigateWorkspaceInPlace(
        "/workspace/settings",
        "/workspace/chats/thread-b",
      ),
    ).toBe(false);
    expect(
      canNavigateWorkspaceInPlace(
        "/workspace/coding",
        "/workspace/coding/project-a",
      ),
    ).toBe(false);
  });

  test("updates browser history and notifies route subscribers", () => {
    const events: string[] = [];
    const onRouteChange = () => events.push(window.location.pathname);
    window.history.replaceState(null, "", "/workspace/chats/thread-a");
    window.addEventListener(WORKSPACE_ROUTE_CHANGE_EVENT, onRouteChange);

    expect(navigateWorkspaceInPlace("/workspace/chats/thread-b")).toBe(true);

    expect(window.location.pathname).toBe("/workspace/chats/thread-b");
    expect(events).toEqual(["/workspace/chats/thread-b"]);

    window.removeEventListener(WORKSPACE_ROUTE_CHANGE_EVENT, onRouteChange);
  });
});
