import { getBackendBaseURL } from "../config";

import { fetch } from "./fetcher";

export interface TokenUsageStats {
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_runs: number;
  total_llm_call_count: number;
  by_model: Record<string, { tokens: number; runs: number; llm_call_count: number; input_tokens: number; output_tokens: number }>;
  efficiency: {
    actual_tokens: number;
    cache_hit_tokens: number;
    token_economy_savings_tokens: number;
    cache_hit_rate: number | null;
  };
}

export interface TokenUsageTimeseriesItem {
  date: string;
  model_name: string;
  run_count: number;
  llm_call_count: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
}

export interface MonthFilter {
  year: number;
  month: number;
}

interface QiongQiUsageCounters {
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  cached_tokens?: number;
  cache_miss_tokens?: number;
  cache_hit_rate?: number | null;
  cost_usd?: number;
  cost_cny?: number;
  cache_savings_usd?: number;
  cache_savings_cny?: number;
  token_economy_savings_tokens?: number;
  token_economy_savings_usd?: number;
  token_economy_savings_cny?: number;
  total_tokens?: number;
  turns?: number;
  thread_count?: number;
}

interface QiongQiModelUsageBucket extends QiongQiUsageCounters {
  model: string;
}

interface QiongQiModelDayBucket extends QiongQiUsageCounters {
  date: string;
}

interface QiongQiThreadUsageBucket extends QiongQiUsageCounters {
  thread_id: string;
}

interface QiongQiModelUsageResponse {
  group_by: "model";
  buckets?: QiongQiModelUsageBucket[];
  days?: QiongQiModelDayBucket[];
  totals?: QiongQiUsageCounters;
}

interface QiongQiDailyUsageResponse {
  group_by: "day";
  buckets?: QiongQiModelDayBucket[];
  totals?: QiongQiUsageCounters;
}

interface QiongQiThreadUsageResponse {
  group_by: "thread";
  buckets?: QiongQiThreadUsageBucket[];
  totals?: QiongQiUsageCounters;
}

export interface QiongQiThreadUsage {
  threadId: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  turns: number;
  cachedTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  cacheHitRate: number | null;
  costUsd: number;
  costCny: number;
  cacheSavingsUsd: number;
  cacheSavingsCny: number;
  tokenEconomySavingsTokens: number;
  tokenEconomySavingsUsd: number;
  tokenEconomySavingsCny: number;
}

function dateWindowFromFilter(filter?: MonthFilter): { from: string; to: string } {
  if (!filter) {
    const to = new Date();
    const from = new Date(to.getTime());
    from.setDate(from.getDate() - 30);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }

  const monthStart = new Date(Date.UTC(filter.year, filter.month - 1, 1));
  const monthEnd = new Date(Date.UTC(filter.year, filter.month, 0));
  return {
    from: monthStart.toISOString().slice(0, 10),
    to: monthEnd.toISOString().slice(0, 10),
  };
}

async function fetchQiongQiModelUsage(
  filter?: MonthFilter,
): Promise<QiongQiModelUsageResponse> {
  const { from, to } = dateWindowFromFilter(filter);
  const params = new URLSearchParams({
    group_by: "model",
    from,
    to,
    timezone: "Asia/Shanghai",
  });
  const res = await fetch(`${getBackendBaseURL()}/api/usage?${params}`, {
    method: "GET",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch token usage: ${res.status}`);
  }
  return (await res.json()) as QiongQiModelUsageResponse;
}

async function fetchQiongQiDailyUsage(
  filter?: MonthFilter,
): Promise<QiongQiDailyUsageResponse> {
  const { from, to } = dateWindowFromFilter(filter);
  const params = new URLSearchParams({
    group_by: "day",
    from,
    to,
    timezone: "Asia/Shanghai",
  });
  const res = await fetch(`${getBackendBaseURL()}/api/usage?${params}`, {
    method: "GET",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch token usage timeseries: ${res.status}`);
  }
  return (await res.json()) as QiongQiDailyUsageResponse;
}

export async function fetchQiongQiThreadUsage(
  threadId: string,
): Promise<QiongQiThreadUsage | null> {
  if (!threadId.trim()) return null;
  const params = new URLSearchParams({ group_by: "thread" });
  const res = await fetch(`${getBackendBaseURL()}/api/usage?${params}`, {
    method: "GET",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch QiongQi thread usage: ${res.status}`);
  }
  const data = (await res.json()) as QiongQiThreadUsageResponse;
  const bucket = (data.buckets ?? []).find((item) => item.thread_id === threadId);
  return bucket ? qiongQiThreadUsageFromBucket(bucket) : null;
}

function qiongQiThreadUsageFromBucket(
  bucket: QiongQiThreadUsageBucket,
): QiongQiThreadUsage {
  return {
    threadId: bucket.thread_id,
    inputTokens: bucket.input_tokens ?? 0,
    outputTokens: bucket.output_tokens ?? 0,
    reasoningTokens: bucket.reasoning_tokens ?? 0,
    totalTokens: bucket.total_tokens ?? 0,
    turns: bucket.turns ?? 0,
    cachedTokens: bucket.cached_tokens ?? 0,
    cacheHitTokens: bucket.cached_tokens ?? 0,
    cacheMissTokens: bucket.cache_miss_tokens ?? 0,
    cacheHitRate: bucket.cache_hit_rate ?? null,
    costUsd: bucket.cost_usd ?? 0,
    costCny: bucket.cost_cny ?? 0,
    cacheSavingsUsd: bucket.cache_savings_usd ?? 0,
    cacheSavingsCny: bucket.cache_savings_cny ?? 0,
    tokenEconomySavingsTokens: bucket.token_economy_savings_tokens ?? 0,
    tokenEconomySavingsUsd: bucket.token_economy_savings_usd ?? 0,
    tokenEconomySavingsCny: bucket.token_economy_savings_cny ?? 0,
  };
}

/**
 * Fetch global token usage statistics across all threads for the current user.
 * Optionally filter by calendar month.
 */
export async function fetchTokenUsageStats(
  filter?: MonthFilter,
): Promise<TokenUsageStats> {
  const data = await fetchQiongQiModelUsage(filter);
  const by_model: TokenUsageStats["by_model"] = {};
  for (const bucket of data.buckets ?? []) {
    by_model[bucket.model] = {
      tokens: bucket.total_tokens ?? 0,
      runs: bucket.turns ?? 0,
      llm_call_count: bucket.turns ?? 0,
      input_tokens: bucket.input_tokens ?? 0,
      output_tokens: bucket.output_tokens ?? 0,
    };
  }

  return {
    total_tokens: data.totals?.total_tokens ?? 0,
    total_input_tokens: data.totals?.input_tokens ?? 0,
    total_output_tokens: data.totals?.output_tokens ?? 0,
    total_runs: data.totals?.turns ?? 0,
    total_llm_call_count: data.totals?.turns ?? 0,
    by_model,
    efficiency: {
      actual_tokens: data.totals?.total_tokens ?? 0,
      cache_hit_tokens: data.totals?.cached_tokens ?? 0,
      token_economy_savings_tokens:
        data.totals?.token_economy_savings_tokens ?? 0,
      cache_hit_rate: data.totals?.cache_hit_rate ?? null,
    },
  };
}

/**
 * Fetch daily token usage timeseries, grouped by date and model.
 * Optionally filter by calendar month instead of rolling days window.
 */
export async function fetchTokenUsageTimeseries(
  days = 30,
  filter?: MonthFilter,
): Promise<TokenUsageTimeseriesItem[]> {
  const data = await fetchQiongQiDailyUsage(filter);
  return (data.buckets ?? [])
    .map((day) => ({
      date: day.date,
      model_name: "__all__",
      run_count: day.turns ?? 0,
      llm_call_count: day.turns ?? 0,
      total_tokens: day.total_tokens ?? 0,
      input_tokens: day.input_tokens ?? 0,
      output_tokens: day.output_tokens ?? 0,
    }))
    .slice(-days);
}
