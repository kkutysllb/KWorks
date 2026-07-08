import type { BundledLanguage } from "shiki";

import type { Translations } from "@/core/i18n";

export type ToolCallDisplayDetail =
  | {
      kind: "badge";
      value: string;
    }
  | {
      kind: "code";
      language: BundledLanguage;
      value: string;
    };

export type ToolCallDisplay = {
  label: string;
  detail?: ToolCallDisplayDetail;
};

export function describeToolCallDisplay(
  name: string,
  args: Record<string, unknown>,
  t: Translations,
): ToolCallDisplay {
  const description = stringArg(args, "description");
  const path = firstStringArg(args, ["path", "file_path", "filepath"]);
  const pattern = stringArg(args, "pattern");

  if (name === "bash") {
    const command = stringArg(args, "command");
    const action = stringArg(args, "action");
    const sessionId = stringArg(args, "session_id");
    const input = stringArg(args, "input");
    const rawFallback = stringArg(args, "__raw");

    // Long-running bash sessions use action=poll/write/stop with no `command`.
    // Give each a meaningful label instead of the generic "执行命令", so the
    // user can tell what the agent is doing while a command runs.
    const sessionLabel =
      action === "poll"
        ? t.toolCalls.bashPoll
        : action === "write"
          ? t.toolCalls.bashWrite
          : action === "stop"
            ? t.toolCalls.bashStop
            : t.toolCalls.executeCommand;

    const detail: ToolCallDisplayDetail | undefined = command
      ? { kind: "code", language: "bash", value: command }
      : action === "write" && input
        ? { kind: "code", language: "bash", value: input }
        : sessionId
          ? { kind: "badge", value: sessionId }
          : rawFallback
            ? { kind: "code", language: "bash", value: rawFallback }
            : undefined;

    // `description` (model-supplied) still wins over our inferred label.
    return {
      label: description ?? (command ? t.toolCalls.executeCommand : sessionLabel),
      ...(detail ? { detail } : {}),
    };
  }

  if (name === "ls") {
    return {
      label: description ?? t.toolCalls.listFolder,
      ...(path ? { detail: { kind: "badge", value: path } } : {}),
    };
  }

  if (name === "read" || name === "read_file") {
    return {
      label: description ?? t.toolCalls.readFile,
      ...(path ? { detail: { kind: "badge", value: path } } : {}),
    };
  }

  if (name === "write" || name === "write_file") {
    return {
      label: description ?? t.toolCalls.writeFile,
      ...(path ? { detail: { kind: "badge", value: path } } : {}),
    };
  }

  if (name === "edit" || name === "str_replace") {
    return {
      label: description ?? t.toolCalls.editFile,
      ...(path ? { detail: { kind: "badge", value: path } } : {}),
    };
  }

  if (name === "grep") {
    const detail = firstStringArg(args, ["path", "glob"]);
    return {
      label:
        description ??
        (pattern ? t.toolCalls.searchText(pattern) : t.toolCalls.useTool(name)),
      ...(detail ? { detail: { kind: "badge", value: detail } } : {}),
    };
  }

  if (name === "find") {
    return {
      label:
        description ??
        (pattern ? t.toolCalls.findFiles(pattern) : t.toolCalls.useTool(name)),
      ...(path ? { detail: { kind: "badge", value: path } } : {}),
    };
  }

  return {
    label: description ?? t.toolCalls.useTool(name),
    ...(path ? { detail: { kind: "badge", value: path } } : {}),
  };
}

function stringArg(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function firstStringArg(
  args: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = stringArg(args, key);
    if (value) return value;
  }
  return undefined;
}
