import { describe, expect, test } from "vitest";

import { createApprovalStore } from "@/core/threads/approval-store";

describe("approval-store", () => {
  test("addPending records a pending approval", () => {
    const store = createApprovalStore();
    store.addPending({
      approvalId: "ap_1",
      toolName: "bash",
      summary: "run npm install",
    });
    const pending = store.allPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      approvalId: "ap_1",
      toolName: "bash",
      status: "pending",
    });
  });

  test("resolve marks an approval allowed/denied by id", () => {
    const store = createApprovalStore();
    store.addPending({ approvalId: "ap_1", toolName: "bash", summary: "x" });
    store.resolve("ap_1", "denied");
    expect(store.get("ap_1")?.status).toBe("denied");
  });

  test("claimForTool returns the most recent pending approval for a toolName and marks it claimed", () => {
    const store = createApprovalStore();
    store.addPending({ approvalId: "ap_1", toolName: "bash", summary: "first" });
    store.addPending({ approvalId: "ap_2", toolName: "bash", summary: "second" });
    const claimed = store.claimForTool("bash");
    // most recent pending wins
    expect(claimed?.approvalId).toBe("ap_2");
    // claiming again returns the next pending
    const next = store.claimForTool("bash");
    expect(next?.approvalId).toBe("ap_1");
    // no more pending
    expect(store.claimForTool("bash")).toBeUndefined();
  });

  test("claimForTool skips already-resolved approvals", () => {
    const store = createApprovalStore();
    store.addPending({ approvalId: "ap_1", toolName: "bash", summary: "x" });
    store.resolve("ap_1", "allowed");
    expect(store.claimForTool("bash")).toBeUndefined();
  });

  test("peekForTool returns most-recent pending without removing it", () => {
    const store = createApprovalStore();
    store.addPending({ approvalId: "ap_1", toolName: "bash", summary: "first" });
    store.addPending({ approvalId: "ap_2", toolName: "bash", summary: "second" });
    const peeked = store.peekForTool("bash");
    // most recent pending wins
    expect(peeked?.approvalId).toBe("ap_2");
    // peeking again returns the same approval (not removed)
    expect(store.peekForTool("bash")?.approvalId).toBe("ap_2");
  });

  test("peekForTool skips resolved approvals", () => {
    const store = createApprovalStore();
    store.addPending({ approvalId: "ap_1", toolName: "bash", summary: "x" });
    store.resolve("ap_1", "allowed");
    expect(store.peekForTool("bash")).toBeUndefined();
  });

  test("get returns a resolved approval's final status", () => {
    const store = createApprovalStore();
    store.addPending({ approvalId: "ap_1", toolName: "bash", summary: "x" });
    store.resolve("ap_1", "allowed");
    expect(store.get("ap_1")).toMatchObject({
      approvalId: "ap_1",
      status: "allowed",
    });
  });
});
