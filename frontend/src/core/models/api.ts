import { fetch } from "../api/fetcher";
import { getBackendBaseURL } from "../config";

import type { Model, ModelRequest, ModelsResponse } from "./types";

export async function loadModels(): Promise<ModelsResponse> {
  const res = await fetch(`${getBackendBaseURL()}/api/models`);
  const data = (await res.json()) as Partial<ModelsResponse>;
  return {
    models: data.models ?? [],
    token_usage: data.token_usage ?? { enabled: false },
  };
}

export async function createModel(req: ModelRequest): Promise<Model> {
  const res = await fetch(`${getBackendBaseURL()}/api/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(await responseErrorMessage(res, "create model"));
  }
  return (await res.json()) as Model;
}

export async function updateModel(name: string, req: ModelRequest): Promise<Model> {
  const res = await fetch(`${getBackendBaseURL()}/api/models/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(await responseErrorMessage(res, "update model"));
  }
  return (await res.json()) as Model;
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetch(`${getBackendBaseURL()}/api/models/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await responseErrorMessage(res, "delete model"));
  }
}

export async function activateModel(name: string): Promise<void> {
  const res = await fetch(`${getBackendBaseURL()}/api/models/${encodeURIComponent(name)}/activate`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await responseErrorMessage(res, "activate model"));
  }
}

async function responseErrorMessage(res: Response, action: string): Promise<string> {
  const body = await res.json().catch(() => ({})) as {
    detail?: unknown;
    message?: unknown;
    error?: unknown;
    code?: unknown;
  };
  const message =
    typeof body.detail === "string"
      ? body.detail
      : typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : undefined;
  const code = typeof body.code === "string" ? ` (${body.code})` : "";
  return message ? `${message}${code}` : `Failed to ${action} (${res.status})`;
}
