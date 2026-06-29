import type { Todo } from "../todos";

import type { Message, Thread } from "./qiongqi-types";

export interface AgentThreadState extends Record<string, unknown> {
  title: string;
  messages: Message[];
  artifacts: string[];
  todos?: Todo[];
  workModeId?: string;
}

export interface AgentThreadContext extends Record<string, unknown> {
  thread_id: string;
  model_name: string | undefined;
  thinking_enabled: boolean;
  is_plan_mode: boolean;
  subagent_enabled: boolean;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  agent_name?: string;
  taskMode?: "agent" | "plan";
  executionProfile?: "fast" | "balanced" | "deep";
  collaborationPolicy?: "single" | "auto";
  workModeId?: string;
  workspaceRoot?: string;
  projectId?: string;
  activeSkillId?: string;
  skillIntent?: string;
  targetSkillId?: string;
}

export interface AgentThread extends Thread<AgentThreadState> {
  context?: AgentThreadContext;
}

export interface RunMessage {
  run_id: string;
  content: Message;
  metadata: {
    caller: string;
  };
  created_at: string;
}
