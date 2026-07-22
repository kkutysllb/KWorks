/**
 * API functions for file uploads
 */

import { fetch } from "../api/fetcher";
import { getBackendBaseURL } from "../config";

export interface UploadedFileInfo {
  filename: string;
  size: number;
  path: string;
  virtual_path: string;
  artifact_url: string;
  extension?: string;
  modified?: number;
  markdown_file?: string;
  markdown_path?: string;
  markdown_virtual_path?: string;
  markdown_artifact_url?: string;
}

export interface UploadResponse {
  success: boolean;
  files: UploadedFileInfo[];
  message: string;
}

async function readErrorDetail(
  response: Response,
  fallback: string,
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  let detail: string | undefined;

  if (contentType.includes("application/json")) {
    const error = (await response.json().catch(() => null)) as
      | {
          detail?: unknown;
          message?: unknown;
          error?: unknown;
        }
      | null;
    const value = error?.detail ?? error?.message ?? error?.error;
    if (typeof value === "string" && value.trim()) {
      detail = value.trim();
    }
  } else {
    const text = await response.text().catch(() => "");
    if (text.trim()) {
      detail = text.trim();
    }
  }

  detail ??= response.statusText || fallback;

  return `${fallback} (${response.status}): ${detail}`;
}

export async function uploadFiles(
  threadId: string,
  files: File[],
): Promise<UploadResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file, file.name || "upload");
  }

  const response = await fetch(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/uploads`,
    {
      method: "POST",
      body: form,
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorDetail(response, "Upload failed"));
  }

  return (await response.json()) as UploadResponse;
}

export async function uploadAttachment(
  threadId: string,
  file: File,
): Promise<UploadedFileInfo> {
  const response = await fetch(`${getBackendBaseURL()}/v1/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name || "upload",
      mimeType: file.type || "application/octet-stream",
      dataBase64: arrayBufferToBase64(await file.arrayBuffer()),
      threadId,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorDetail(response, "Upload failed"));
  }

  const body = (await response.json()) as {
    attachment: {
      id: string;
      name: string;
      mimeType?: string;
      byteSize: number;
      updatedAt?: string;
    };
  };
  const attachment = body.attachment;
  return {
    filename: attachment.name,
    size: attachment.byteSize,
    path: attachment.id,
    virtual_path: attachment.id,
    artifact_url: `/v1/attachments/${encodeURIComponent(attachment.id)}/content`,
    ...extensionFromName(attachment.name),
    ...modifiedFromTimestamp(attachment.updatedAt),
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  const bufferCtor = (
    globalThis as typeof globalThis & {
      Buffer?: { from: (value: Uint8Array) => { toString: (encoding: "base64") => string } };
    }
  ).Buffer;
  return bufferCtor?.from(bytes).toString("base64") ?? "";
}

function extensionFromName(name: string): Pick<UploadedFileInfo, "extension"> {
  const extension = name.split(".").pop();
  return extension && extension !== name ? { extension } : {};
}

function modifiedFromTimestamp(
  value: string | undefined,
): Pick<UploadedFileInfo, "modified"> {
  if (!value) return {};
  const modified = Date.parse(value);
  return Number.isFinite(modified) ? { modified } : {};
}
