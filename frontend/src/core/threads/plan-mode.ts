import type { ToolEndEvent } from "./hooks";

const CREATE_PLAN_TOOL_NAME = "create_plan";

export function isCreatePlanToolEnd(event: ToolEndEvent): boolean {
  return getCreatePlanOutputFromToolEnd(event) !== null;
}

export function isCreatePlanCompletionEvent(event: unknown): boolean {
  return getCreatePlanOutputFromCompletionEvent(event) !== null;
}

export function getCreatePlanCompletionKey(event: unknown): string | null {
  const output =
    getCreatePlanOutputFromToolEnd(event) ??
    getCreatePlanOutputFromCompletionEvent(event);
  if (!output) return null;
  return `${output.plan_id}:${output.relative_path}`;
}

function getCreatePlanOutputFromToolEnd(
  event: unknown,
): CreatePlanOutput | null {
  if (!isRecord(event) || event.name !== CREATE_PLAN_TOOL_NAME) return null;
  return getSuccessfulCreatePlanOutput(event.data);
}

function getCreatePlanOutputFromCompletionEvent(
  event: unknown,
): CreatePlanOutput | null {
  if (!isRecord(event) || event.kind !== "tool_call_finished") return null;
  const item = event.item;
  if (!isRecord(item)) return null;
  if (
    item.kind !== "tool_result" ||
    item.toolName !== CREATE_PLAN_TOOL_NAME ||
    item.isError === true
  ) {
    return null;
  }
  return getSuccessfulCreatePlanOutput(item.output);
}

type CreatePlanOutput = {
  plan_id: string;
  relative_path: string;
};

function getSuccessfulCreatePlanOutput(
  output: unknown,
): CreatePlanOutput | null {
  if (!isRecord(output)) return null;
  if (typeof output.error === "string" && output.error.trim()) return null;
  if (
    typeof output.plan_id !== "string" ||
    output.plan_id.trim().length === 0 ||
    typeof output.relative_path !== "string" ||
    output.relative_path.trim().length === 0
  ) {
    return null;
  }
  return {
    plan_id: output.plan_id.trim(),
    relative_path: output.relative_path.trim(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
