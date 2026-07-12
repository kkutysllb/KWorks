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
}

export async function fetchFinanceCredentialStatus(): Promise<FinanceCredentialStatus> {
  const res = await fetch(`${getBackendBaseURL()}/api/finance/credentials/status`);
  if (!res.ok) throw new Error(`Failed to check credentials: ${res.statusText}`);
  return res.json() as Promise<FinanceCredentialStatus>;
}

export function useFinanceCredentials() {
  return useQuery({
    queryKey: ["finance", "credentials", "status"],
    queryFn: fetchFinanceCredentialStatus,
    staleTime: 60_000,
  });
}
