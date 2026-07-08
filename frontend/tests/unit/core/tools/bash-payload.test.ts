import { describe, expect, test } from "vitest";

import {
  extractBashOutput,
  isBashPayload,
  type BashPayload,
} from "@/core/tools/bash-payload";

describe("bash-payload", () => {
  const fullPayload: BashPayload = {
    command: "npm run build",
    cwd: "/repo",
    shell: "/bin/zsh",
    exit_code: 0,
    output: "> building\n✓ done",
    full_output_path: null,
    truncation: null,
  };

  test("isBashPayload true for a payload with command + output + exit_code", () => {
    expect(isBashPayload(fullPayload)).toBe(true);
  });

  test("isBashPayload false for plain strings", () => {
    expect(isBashPayload("some stdout")).toBe(false);
    expect(isBashPayload(null)).toBe(false);
    expect(isBashPayload({})).toBe(false);
  });

  test("extractBashOutput returns output/exitCode/truncation from a full payload", () => {
    expect(extractBashOutput(fullPayload)).toEqual({
      output: "> building\n✓ done",
      exitCode: 0,
      truncation: null,
      truncatedLines: null,
    });
  });

  test("extractBashOutput reads total_lines for the collapsed-line count", () => {
    const payload: BashPayload = {
      ...fullPayload,
      truncation: {
        total_lines: 142,
        output_lines: 12,
        total_bytes: 8000,
        output_bytes: 600,
        truncated_by: "lines",
        last_line_partial: false,
      },
    };
    expect(extractBashOutput(payload).truncatedLines).toBe(142);
  });

  test("extractBashOutput returns nulls when output is missing", () => {
    expect(extractBashOutput({ foo: "bar" })).toEqual({
      output: undefined,
      exitCode: undefined,
      truncation: undefined,
      truncatedLines: undefined,
    });
  });
});
