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
 * Bash tool is also a file-producing tool when the command writes to a file.
 * We detect output files from bash commands by looking for redirect patterns.
 */
const BASH_TOOL_NAMES = new Set(["bash", "execute_bash", "run_bash"]);

/** File extensions we care about for result-file listing. */
const RESULT_FILE_EXTENSIONS = new Set([
  ".md",
  ".html",
  ".csv",
  ".json",
  ".txt",
  ".xlsx",
  ".pdf",
  ".png",
  ".jpg",
]);

/**
 * Extract the file path from a tool-call argument object. Mirrors the key
 * precedence in describeToolCallDisplay so the result-file list matches what
 * the chain-of-thought UI shows.
 */
function filePathFromArgs(args: Record<string, unknown>): string | undefined {
  for (const key of ["path", "file_path", "filepath"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) {
      return sanitizeResultFilePath(value.trim());
    }
  }
  return undefined;
}

/**
 * Extract output file paths from a bash command string. Detects common
 * redirect patterns: `> file`, `>> file`, `cat > file`, `echo ... > file`,
 * `python script.py > file`, `tee file`, etc.
 */
function filePathsFromBashCommand(command: unknown): string[] {
  if (typeof command !== "string" || !command) return [];
  const paths: string[] = [];
  // Match: > or >> followed by a file path (with optional quotes)
  const redirectRe = /(?:>{1,2}|tee\s+)(?:\s*)(['"]?)([^\s'";|&<>]+)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = redirectRe.exec(command)) !== null) {
    const path = match[2];
    if (path) {
      const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
      if (RESULT_FILE_EXTENSIONS.has(ext)) {
        paths.push(sanitizeResultFilePath(path));
      }
    }
  }
  return paths;
}

function resultFilesByToolCallId(messages: Message[]): Map<string, string[]> {
  const byCallId = new Map<string, string[]>();
  for (const message of messages) {
    if (message.type !== "tool" || !message.tool_call_id) continue;
    const files = resultFilesFromToolMessage(message.content);
    if (files.length > 0) byCallId.set(message.tool_call_id, files);
  }
  return byCallId;
}

function resultFilesFromToolMessage(content: Message["content"]): string[] {
  if (typeof content !== "string" || !content.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const resultFiles = (parsed as { result_files?: unknown }).result_files;
  if (!Array.isArray(resultFiles)) return [];
  return resultFiles
    .map((file) => {
      if (!file || typeof file !== "object") return undefined;
      const relativePath = (file as { relative_path?: unknown }).relative_path;
      if (typeof relativePath === "string" && relativePath.trim()) {
        return relativePath.trim();
      }
      const path = (file as { path?: unknown }).path;
      return typeof path === "string" && path.trim()
        ? sanitizeResultFilePath(path.trim())
        : undefined;
    })
    .filter((path): path is string => Boolean(path));
}

function sanitizeResultFilePath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  if (
    normalized.startsWith("/tmp/") ||
    normalized.startsWith("/private/tmp/") ||
    normalized.startsWith("/var/tmp/") ||
    normalized.startsWith("/var/folders/") ||
    normalized.startsWith("/mnt/")
  ) {
    return normalized.split("/").filter(Boolean).at(-1) ?? path;
  }
  return path;
}

/**
 * Collect the result-file paths produced by write/edit/str_replace tool calls
 * across a thread's messages. Returns a de-duplicated, order-preserved list.
 *
 * This is the data source for the "结果文件" strip above the input box: rather
 * than enumerating a thread outputs/ directory (which write tools never write
 * to), we derive the list from the tool calls the model actually made — those
 * are the files the user cares about previewing and downloading.
 *
 * In addition to write/edit tools, bash commands that redirect to files with
 * known extensions (.md, .html, .csv, etc.) are also detected.
 */
export function collectResultFiles(messages: Message[]): string[] {
  const seen = new Set<string>();
  const files: string[] = [];
  const materializedFilesByCallId = resultFilesByToolCallId(messages);
  for (const message of messages) {
    if (message.type !== "ai" || !message.tool_calls) continue;
    for (const toolCall of message.tool_calls) {
      const materializedFiles = toolCall.id
        ? materializedFilesByCallId.get(toolCall.id)
        : undefined;
      if (materializedFiles) {
        for (const path of materializedFiles) {
          if (!seen.has(path)) {
            seen.add(path);
            files.push(path);
          }
        }
        continue;
      }
      // Standard write/edit tools
      if (FILE_PRODUCING_TOOLS.has(toolCall.name)) {
        const path = filePathFromArgs(toolCall.args ?? {});
        if (path && !seen.has(path)) {
          seen.add(path);
          files.push(path);
        }
        continue;
      }
      // Bash tool — detect file redirects in the command string
      if (BASH_TOOL_NAMES.has(toolCall.name)) {
        const command = (toolCall.args as Record<string, unknown>)?.command;
        const bashPaths = filePathsFromBashCommand(command);
        for (const path of bashPaths) {
          if (!seen.has(path)) {
            seen.add(path);
            files.push(path);
          }
        }
      }
    }
  }
  return files;
}

/**
 * The completion view owns an automatic delivery manifest. Explicit
 * `present_files` messages already render their own list, so the automatic
 * manifest must not duplicate them.
 */
export function shouldShowDeliveryManifest(
  messages: Message[],
  isLoading: boolean,
): boolean {
  if (isLoading) return false;
  const taskMessages = messagesSinceLastUserMessage(messages);
  if (
    taskMessages.some(
      (message) =>
        message.type === "ai" &&
        message.tool_calls?.some(
          (toolCall) => toolCall.name === "present_files",
        ),
    )
  ) {
    return false;
  }
  return collectResultFiles(taskMessages).length > 0;
}

/** Return files produced after the latest user message in this thread. */
export function collectLatestTaskResultFiles(messages: Message[]): string[] {
  return collectResultFiles(messagesSinceLastUserMessage(messages));
}

function messagesSinceLastUserMessage(messages: Message[]): Message[] {
  let lastUserMessageIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.type === "human") {
      lastUserMessageIndex = index;
      break;
    }
  }
  return messages.slice(lastUserMessageIndex + 1);
}
