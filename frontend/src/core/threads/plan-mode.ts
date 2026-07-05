import type { ToolEndEvent } from "./hooks";

const CREATE_PLAN_TOOL_NAME = "create_plan";

export function isCreatePlanToolEnd(event: ToolEndEvent): boolean {
  return (
    event.name === CREATE_PLAN_TOOL_NAME &&
    isSuccessfulCreatePlanOutput(event.data)
  );
}

export function isCreatePlanCompletionEvent(event: unknown): boolean {
  if (!isRecord(event) || event.kind !== "tool_call_finished") return false;
  const item = event.item;
  if (!isRecord(item)) return false;
  return (
    item.kind === "tool_result" &&
    item.toolName === CREATE_PLAN_TOOL_NAME &&
    item.isError !== true &&
    isSuccessfulCreatePlanOutput(item.output)
  );
}

function isSuccessfulCreatePlanOutput(output: unknown): boolean {
  if (!isRecord(output)) return false;
  if (typeof output.error === "string" && output.error.trim()) return false;
  return (
    typeof output.plan_id === "string" &&
    output.plan_id.trim().length > 0 &&
    typeof output.relative_path === "string" &&
    output.relative_path.trim().length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
