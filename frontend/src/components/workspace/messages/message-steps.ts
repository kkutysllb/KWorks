/**
 * Pure (render-free) derivation of chain-of-thought "steps" from a message
 * list.
 *
 * Extracted from `message-group.tsx` so the step logic can be unit-tested in
 * isolation — importing `message-group` pulls the whole Streamdown/katex render
 * tree, which is unsuitable for a pure-logic test (Node can't resolve the
 * transitive `katex/dist/katex.min.css` import). Everything in this module is
 * side-effect free and depends only on `@/core/messages/utils`,
 * `@/core/threads/qiongqi-types`, `@/core/tools/bash-payload`, and a type from
 * `./bash-command-card` (type-only).
 *
 * Status / output / exit code are read from the TurnItem the backend mirrors
 * onto each message as `additional_kwargs.qiongqi_item` (see
 * `turnItemToMessage` in qiongqi-client.ts):
 *  - the `tool_call` item carries `status` (pending/running/completed/failed);
 *  - the matching `tool_result` message (same `callId`) carries `output` (the
 *    BashPayload object for bash), `isError`, and a more authoritative
 *    `status`.
 */
import {
  extractReasoningContentFromMessage,
  findToolCallResult,
  stripInternalContent,
} from "@/core/messages/utils";
import type { ApprovalStore } from "@/core/threads/approval-store";
import type { Message } from "@/core/threads/qiongqi-types";
import { extractBashOutput } from "@/core/tools/bash-payload";

import type { ToolCallStatus } from "./bash-command-card";

interface GenericCoTStep<T extends string = string> {
  id?: string;
  messageId?: string;
  type: T;
}

interface CoTReasoningStep extends GenericCoTStep<"reasoning"> {
  reasoning: string | null;
}

interface CoTToolCallStep extends GenericCoTStep<"toolCall"> {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: ToolCallStatus;
  isError?: boolean;
  outputText?: string;
  exitCode?: number | null;
  lineCount?: number;
  /** Inline approval (claimed from the ApprovalStore) for this tool call. */
  approval?: {
    approvalId: string;
    status: "pending" | "allowed" | "denied" | "expired";
    summary: string;
  };
}

export type CoTStep = CoTReasoningStep | CoTToolCallStep;
export type { CoTToolCallStep, CoTReasoningStep, GenericCoTStep };

export function convertToSteps(
  messages: Message[],
  approvalStore?: ApprovalStore,
): CoTStep[] {
  const steps: CoTStep[] = [];
  for (const message of messages) {
    if (message.type !== "ai") {
      continue;
    }
    const reasoning = extractReasoningContentFromMessage(message);
    if (reasoning) {
      const step: CoTReasoningStep = {
        id: message.id,
        messageId: message.id,
        type: "reasoning",
        reasoning: stripInternalContent(reasoning),
      };
      steps.push(step);
    }
    const toolCalls = message.tool_calls ?? [];
    for (const tool_call of toolCalls) {
      if (tool_call.name === "task") {
        continue;
      }
      const toolCallId = tool_call.id;

      // Status from the tool_call TurnItem (default pending).
      const callItem = (message.additional_kwargs?.qiongqi_item ?? {}) as {
        status?: ToolCallStatus;
      };
      let status: ToolCallStatus = callItem.status ?? "pending";
      let isError: boolean | undefined;
      let outputText: string | undefined;
      let exitCode: number | null | undefined;
      let lineCount: number | undefined;

      // The matching tool_result message (same callId) carries the more
      // authoritative status plus output/isError.
      if (toolCallId) {
        for (const candidate of messages) {
          if (
            candidate.type !== "tool" ||
            candidate.tool_call_id !== toolCallId
          ) {
            continue;
          }
          const resultItem = (candidate.additional_kwargs?.qiongqi_item ??
            {}) as {
            status?: ToolCallStatus;
            output?: unknown;
            isError?: boolean;
          };
          if (resultItem.status) {
            status = resultItem.status;
          }
          isError = resultItem.isError;
          if (tool_call.name === "bash") {
            const view = extractBashOutput(resultItem.output);
            outputText = view.output;
            exitCode = view.exitCode;
            lineCount = view.truncatedLines ?? undefined;
          }
          break;
        }
      }

      const step: CoTToolCallStep = {
        id: tool_call.id,
        messageId: message.id,
        type: "toolCall",
        name: tool_call.name,
        args: tool_call.args,
        status,
        ...(isError !== undefined ? { isError } : {}),
        ...(outputText !== undefined ? { outputText } : {}),
        ...(exitCode !== undefined ? { exitCode } : {}),
        ...(lineCount !== undefined ? { lineCount } : {}),
      };

      // Preserve the existing result-field population for non-bash consumers
      // (e.g. web_search). findToolCallResult returns the raw tool_result
      // content string; we try to parse it as JSON, falling back to the raw
      // string.
      if (toolCallId) {
        const toolCallResult = findToolCallResult(toolCallId, messages);
        if (toolCallResult) {
          try {
            step.result = JSON.parse(toolCallResult);
          } catch {
            step.result = toolCallResult;
          }
        }
      }

      steps.push(step);
    }
  }

  // Attach any pending approvals peeked from the store. `peekForTool` is
  // read-only — it does NOT remove the approval — so this render path is
  // idempotent (safe under React StrictMode, which double-invokes useMemo).
  // When the user clicks Allow/Deny, `hooks.ts` calls
  // `approvalStore.resolve(approvalId, decision)`, which updates the entry's
  // status in place; the next render's peek then skips it (no longer pending)
  // and the card re-renders without the buttons. Correlation is by toolName +
  // recency, not callId — a known limitation noted in the store.
  if (approvalStore) {
    for (const step of steps) {
      if (step.type !== "toolCall") continue;
      const claimed = approvalStore.peekForTool(step.name);
      if (claimed) {
        (step).approval = {
          approvalId: claimed.approvalId,
          status: claimed.status,
          summary: claimed.summary,
        };
      }
    }
  }
  return steps;
}
