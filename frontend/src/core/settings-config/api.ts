import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfigData = Record<string, unknown>;

export interface ConfigSectionResponse {
  section: string;
  data: unknown;
}

export interface FullConfigResponse {
  config: ConfigData;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Load the full config.yaml (with sensitive values masked by the backend).
 */
export async function loadConfig(): Promise<ConfigData> {
  const res = await fetch(`${getBackendBaseURL()}/api/config`);
  if (!res.ok) {
    throw new Error(`Failed to load config (${res.status})`);
  }
  const data = (await res.json()) as Partial<FullConfigResponse>;
  return data.config ?? {};
}

/**
 * Load a single top-level section from config.yaml.
 */
export async function loadConfigSection(
  section: string,
): Promise<unknown> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/config/${encodeURIComponent(section)}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load config section '${section}' (${res.status})`);
  }
  const data = (await res.json()) as Partial<ConfigSectionResponse>;
  return data.data ?? null;
}

/**
 * Replace the entire config.yaml with new data.
 */
export async function saveFullConfig(data: ConfigData): Promise<ConfigData> {
  const res = await fetch(`${getBackendBaseURL()}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: data }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(
      (detail as { detail?: string }).detail ??
        `Failed to save config (${res.status})`,
    );
  }
  const result = (await res.json()) as Partial<FullConfigResponse>;
  return result.config ?? {};
}

/**
 * Save a single top-level section to config.yaml.
 */
export async function saveConfigSection(
  section: string,
  data: unknown,
): Promise<unknown> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/config/${encodeURIComponent(section)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    },
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(
      (detail as { detail?: string }).detail ??
        `Failed to save config section '${section}' (${res.status})`,
    );
  }
  const result = (await res.json()) as Partial<ConfigSectionResponse>;
  return result.data ?? null;
}
