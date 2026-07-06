import type { Message } from "../threads/qiongqi-types";

/**
 * Tool names that produce or modify result files in the workspace.
 */
const FILE_PRODUCING_TOOLS = new Set([
  "write",
  "write_file",
  "edit",
  "str_replace",
]);

/**
 * Extract the file path from a tool-call argument object. Mirrors the key
 * precedence in describeToolCallDisplay so the result-file list matches what
 * the chain-of-thought UI shows.
 */
function filePathFromArgs(args: Record<string, unknown>): string | undefined {
  for (const key of ["path", "file_path", "filepath"]) {
    const value = args[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

/**
 * Collect the result-file paths produced by write/edit/str_replace tool calls
 * across a thread's messages. Returns a de-duplicated, order-preserved list.
 *
 * This is the data source for the "结果文件" strip above the input box: rather
 * than enumerating a thread outputs/ directory (which write tools never write
 * to), we derive the list from the tool calls the model actually made — those
 * are the files the user cares about previewing and downloading.
 */
export function collectResultFiles(messages: Message[]): string[] {
  const seen = new Set<string>()
  const files: string[] = []
  for (const message of messages) {
    if (message.type !== "ai" || !message.tool_calls) continue
    for (const toolCall of message.tool_calls) {
      if (!FILE_PRODUCING_TOOLS.has(toolCall.name)) continue
      const path = filePathFromArgs(toolCall.args ?? {})
      if (!path) continue
      // Normalize for dedup: same file written twice should appear once.
      const key = path
      if (!seen.has(key)) {
        seen.add(key)
        files.push(path)
      }
    }
  }
  return files
}
