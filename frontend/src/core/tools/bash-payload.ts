/**
 * Shape of the bash tool's {@link ToolResultTurnItem.output}, produced by the
 * qiongqi `builtin-bash-tool`. See
 * `qiongqi/packages/adapters/adapter-tools/src/builtin-bash-tool.ts:45-73`.
 *
 * stdout and stderr are MERGED into `output` — there is no way to tell them
 * apart, so the UI must color them uniformly.
 */
export interface BashPayload {
  command: string;
  cwd: string;
  shell: string;
  exit_code: number | null;
  output: string;
  full_output_path: string | null;
  truncation: BashTruncation | null;
  session_id?: string;
  status?: "running" | "completed" | "stopped" | "failed";
  started_at?: string;
  finished_at?: string;
  pid?: number;
  partial?: boolean;
  stop_sent?: boolean;
  error?: string;
}

export interface BashTruncation {
  total_lines: number;
  output_lines: number;
  total_bytes: number;
  output_bytes: number;
  truncated_by: string | null;
  last_line_partial: boolean;
}

/** Structured view of a bash payload for the command card. */
export interface BashOutputView {
  output: string | undefined;
  exitCode: number | null | undefined;
  truncation: BashTruncation | null | undefined;
  /** Line count to show in the collapsed header ("N 行输出"). */
  truncatedLines: number | null | undefined;
}

function hasShape(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isBashPayload(value: unknown): value is BashPayload {
  return (
    hasShape(value) &&
    typeof value.command === "string" &&
    typeof value.output === "string" &&
    (value.exit_code === null || typeof value.exit_code === "number")
  );
}

/**
 * Resolve the collapsed-header line count from a truncation value.
 *
 * - truncation object with numeric `total_lines` → that count (the total lines
 *   the backend withheld/truncated).
 * - explicit `null` (backend ran without truncation) → `null` (no count).
 * - `undefined` (field absent / non-bash object) → `undefined`.
 *
 * We intentionally do NOT fall back to counting `output.split("\n")`: when the
 * backend signals no truncation the card header shows no line count, and
 * counting would mislabel partial payloads.
 */
function resolveTruncatedLines(
  truncation: BashTruncation | null | undefined,
): number | null | undefined {
  if (truncation === null) return null;
  if (truncation === undefined) return undefined;
  return typeof truncation.total_lines === "number"
    ? truncation.total_lines
    : undefined;
}

/**
 * Pull the display-relevant fields out of an opaque tool_result `output`.
 * Works whether `output` is a real BashPayload, a partial object, or unrelated.
 *
 * The `truncation` field is passed through verbatim: an explicit `null` (bash
 * payload that ran without truncation) stays `null`, while an absent key
 * (non-bash object) becomes `undefined` — callers can distinguish "bash, no
 * truncation" from "not bash".
 */
export function extractBashOutput(output: unknown): BashOutputView {
  if (!hasShape(output)) {
    return {
      output: undefined,
      exitCode: undefined,
      truncation: undefined,
      truncatedLines: undefined,
    };
  }
  // Pass truncation through as-is: absent key → undefined, explicit null → null.
  const truncation = output.truncation as BashTruncation | null | undefined;
  return {
    output: typeof output.output === "string" ? output.output : undefined,
    exitCode:
      output.exit_code === null || typeof output.exit_code === "number"
        ? output.exit_code
        : undefined,
    truncation,
    truncatedLines: resolveTruncatedLines(truncation),
  };
}
