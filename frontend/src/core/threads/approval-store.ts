/**
 * In-memory registry of pending/resolved tool approvals.
 *
 * The qiongqi backend signals approvals via the `approval_requested` runtime
 * event plus (on denial) a separate `approval` TurnItem — there is NO
 * approval status on the `tool_call` item itself. This store lets the message
 * renderer correlate an approval to a command card by `toolName`.
 *
 * Known limitation: correlation is by toolName + recency, not by callId. If a
 * turn has two concurrent same-named tools both awaiting approval, the match
 * can be wrong. (Fixing this needs a backend change to carry callId on
 * approval events — out of scope for this redesign.)
 *
 * Consumption model: `claimForTool` pops the matched approval out of the
 * store (removes it) so each pending approval attaches to exactly one tool
 * card. Once claimed, an approval is no longer queryable via `get`/`allPending`
 * — the claiming tool card owns its lifecycle from that point on.
 */

export type ApprovalDecision = "allowed" | "denied" | "expired";

export interface PendingApproval {
  approvalId: string;
  toolName: string;
  summary: string;
  status: "pending" | ApprovalDecision;
}

export interface ApprovalStore {
  /** Record a freshly-requested approval (status `pending`). */
  addPending(input: {
    approvalId: string;
    toolName: string;
    summary: string;
  }): void;
  /** Mark an approval resolved (allowed/denied/expired). */
  resolve(approvalId: string, decision: ApprovalDecision): void;
  /** All approvals still in `pending` state (newest-first). */
  allPending(): PendingApproval[];
  /**
   * Pop the most recent pending approval for `toolName`. Removes it from the
   * store so subsequent calls return the next pending match. Returns
   * undefined when none remain pending.
   */
  claimForTool(toolName: string): PendingApproval | undefined;
  /** Look up any approval (pending or resolved) by id. */
  get(approvalId: string): PendingApproval | undefined;
}

export function createApprovalStore(): ApprovalStore {
  const map = new Map<string, PendingApproval>();

  return {
    addPending({ approvalId, toolName, summary }) {
      map.set(approvalId, { approvalId, toolName, summary, status: "pending" });
    },
    resolve(approvalId, decision) {
      const existing = map.get(approvalId);
      if (existing) existing.status = decision;
    },
    allPending() {
      return [...map.values()]
        .filter((a) => a.status === "pending")
        .reverse();
    },
    claimForTool(toolName) {
      // Map preserves insertion order; iterating reversed yields newest-first.
      for (const [approvalId, approval] of [...map.entries()].reverse()) {
        if (approval.status === "pending" && approval.toolName === toolName) {
          // Pop the claimed approval out of the store so the next call returns
          // the next pending match. The claiming tool card now owns it.
          map.delete(approvalId);
          return approval;
        }
      }
      return undefined;
    },
    get(approvalId) {
      return map.get(approvalId);
    },
  };
}
