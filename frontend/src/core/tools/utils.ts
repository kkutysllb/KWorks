import type { ToolCall } from "@langchain/core/messages";

import type { Translations } from "../i18n";
import { hasToolCalls } from "../messages/utils";
import type { AIMessage } from "../threads/qiongqi-types";

export function isTodoWriteToolName(name: string): boolean {
  return name === "todo_write" || name === "write_todos";
}

export function explainLastToolCall(message: AIMessage, t: Translations) {
  if (hasToolCalls(message)) {
    const lastToolCall = message.tool_calls![message.tool_calls!.length - 1]!;
    return explainToolCall(lastToolCall, t);
  }
  return t.common.thinking;
}

export function explainToolCall(toolCall: ToolCall, t: Translations) {
  if (toolCall.name === "web_search" || toolCall.name === "image_search") {
    return t.toolCalls.searchFor(toolCall.args.query);
  } else if (toolCall.name === "web_fetch") {
    return t.toolCalls.viewWebPage;
  } else if (toolCall.name === "present_files") {
    return t.toolCalls.presentFiles;
  } else if (isTodoWriteToolName(toolCall.name)) {
    return t.toolCalls.writeTodos;
  } else if (toolCall.args.description) {
    return toolCall.args.description;
  } else {
    return t.toolCalls.useTool(toolCall.name);
  }
}
