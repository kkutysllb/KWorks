/**
 * Finance credential status — checks whether the data-source API keys
 * required by the finance work mode's KSkills packages are configured.
 */

import { useQuery } from "@tanstack/react-query";

import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

export interface FinanceCredentialStatus {
  iwencai: boolean;
  tushare: boolean;
  sources?: {
    iwencai: "user" | "environment" | "missing";
    tushare: "user" | "environment" | "missing";
  };
  config?: {
    apiBaseUrl: string;
    queryEndpoint: string;
    comprehensiveEndpoint: string;
    webUrl: string;
  };
}

export type FinanceCredentialUpdate = {
  tushareToken?: string | null;
  iwencaiApiKey?: string | null;
  apiBaseUrl?: string;
  queryEndpoint?: string;
  comprehensiveEndpoint?: string;
  webUrl?: string;
};

const FINANCE_FETCH_RETRY_COUNT = 5;
const FINANCE_FETCH_RETRY_DELAY_MS = 400;

export async function fetchFinanceCredentialStatus(): Promise<FinanceCredentialStatus> {
  const res = await fetchWithRetry(
    `${getBackendBaseURL()}/api/finance/credentials/status`,
  );
  if (!res.ok) throw new Error(`Failed to check credentials: ${res.statusText}`);
  return res.json() as Promise<FinanceCredentialStatus>;
}

export async function fetchFinanceCredentials(): Promise<FinanceCredentialStatus> {
  const res = await fetchWithRetry(`${getBackendBaseURL()}/api/finance/credentials`);
  if (!res.ok) throw new Error(`Failed to load finance credentials: ${res.statusText}`);
  return res.json() as Promise<FinanceCredentialStatus>;
}

export async function saveFinanceCredentials(
  update: FinanceCredentialUpdate,
): Promise<FinanceCredentialStatus> {
  const res = await fetchWithRetry(`${getBackendBaseURL()}/api/finance/credentials`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`Failed to save finance credentials: ${res.statusText}`);
  return res.json() as Promise<FinanceCredentialStatus>;
}

export function useFinanceCredentials() {
  return useQuery({
    queryKey: ["finance", "credentials", "status"],
    queryFn: fetchFinanceCredentialStatus,
    staleTime: 60_000,
  });
}

export function useFinanceCredentialSettings() {
  return useQuery({
    queryKey: ["finance", "credentials"],
    queryFn: fetchFinanceCredentials,
    staleTime: 60_000,
  });
}

async function fetchWithRetry(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= FINANCE_FETCH_RETRY_COUNT; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (
        attempt >= FINANCE_FETCH_RETRY_COUNT ||
        !isRetryableFinanceFetchError(error)
      ) {
        throw error;
      }
      await new Promise((resolve) =>
        globalThis.setTimeout(resolve, FINANCE_FETCH_RETRY_DELAY_MS),
      );
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to fetch");
}

function isRetryableFinanceFetchError(error: unknown): boolean {
  return error instanceof TypeError || (
    error instanceof Error && error.message.includes("Failed to fetch")
  );
}
