import { getBackendBaseURL } from "../config";
import type { AgentThread } from "../threads";

export function urlOfArtifact({
  filepath,
  threadId,
  download = false,
  isMock = false,
}: {
  filepath: string;
  threadId: string;
  download?: boolean;
  isMock?: boolean;
}) {
  if (isMock) {
    return `${getBackendBaseURL()}/mock/api/threads/${threadId}/artifacts${filepath}${download ? "?download=true" : ""}`;
  }
  return artifactContentUrl(filepath, threadId, download);
}

export function extractArtifactsFromThread(thread: AgentThread) {
  return thread.values.artifacts ?? [];
}

export function resolveArtifactURL(absolutePath: string, threadId: string) {
  return artifactContentUrl(absolutePath, threadId);
}

function artifactContentUrl(
  path: string,
  threadId: string,
  download = false,
) {
  const params = new URLSearchParams({ path });
  if (download) params.set("download", "true");
  return `${getBackendBaseURL()}/v1/threads/${encodeURIComponent(threadId)}/artifacts/content?${params.toString()}`;
}
