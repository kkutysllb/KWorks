export interface Model {
  id: string;
  name: string;
  model: string;
  display_name: string;
  api_key?: string | null;
  base_url?: string | null;
  /** Read-only: auto-detected by engine, always true for QiongQi models. */
  supports_thinking?: boolean;
  /** Read-only: auto-detected from model name + provider. */
  supports_vision?: boolean;
  /** Read-only: auto-detected from provider compatibility. */
  supports_reasoning_effort?: boolean;
  /** Read-only: allowed reasoning effort values for this model. */
  reasoning_effort_values?: string[] | null;
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
  model: string;
  api_key?: string | null;
  base_url?: string | null;
}

export interface TokenUsageSettings {
  enabled: boolean;
}

export interface ModelsResponse {
  models: Model[];
  token_usage: TokenUsageSettings;
}
