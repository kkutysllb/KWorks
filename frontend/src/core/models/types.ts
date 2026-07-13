export interface Model {
  id: string;
  name: string;
  use: string;
  model: string;
  display_name: string;
  description?: string | null;
  api_key?: string | null;
  base_url?: string | null;
  max_tokens?: number | null;
  context_window_tokens?: number | null;
  temperature?: number | null;
  request_timeout?: number | null;
  supports_thinking?: boolean;
  supports_vision?: boolean;
  supports_reasoning_effort?: boolean;
  reasoning_effort_values?: string[] | null;
  when_thinking_enabled?: Record<string, unknown> | null;
  when_thinking_disabled?: Record<string, unknown> | null;
  provider_compatibility?: {
    provider?: string;
    thinking_dialect?: string;
    tool_call_protocol?: string;
    request_flags?: Record<string, boolean>;
    fold_tool_history?: boolean;
    requires_assistant_content_for_tool_calls?: boolean;
    requires_user_message?: boolean;
    requires_strict_alternation?: boolean;
  } | null;
  compatibility_warnings?: string[];
  active?: boolean;
}

export interface ModelRequest {
  name: string;
  display_name?: string | null;
  use: string;
  model: string;
  api_key?: string | null;
  base_url?: string | null;
  max_tokens?: number | null;
  context_window_tokens?: number | null;
  temperature?: number | null;
  request_timeout?: number | null;
  description?: string | null;
  supports_thinking?: boolean;
  supports_vision?: boolean;
  supports_reasoning_effort?: boolean;
  reasoning_effort_values?: string[] | null;
  when_thinking_enabled?: Record<string, unknown> | null;
  when_thinking_disabled?: Record<string, unknown> | null;
}

export interface TokenUsageSettings {
  enabled: boolean;
}

export interface ModelsResponse {
  models: Model[];
  token_usage: TokenUsageSettings;
}
