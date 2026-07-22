import type {
  ToolCallLike,
  ToolExecutionUpdate,
  ToolHostContext,
  ToolHostResult,
  ToolProviderPolicy
} from '@qiongqi/ports'
import type { LoadedSkillPlugin } from './plugin-host.js'

type LocalTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  toolKind: 'tool_call' | 'command_execution' | 'file_change'
  policy: 'auto' | 'on-request' | 'suggest' | 'never' | 'untrusted'
  shouldAdvertise?: (context: ToolHostContext) => boolean
  execute: (
    args: Record<string, unknown>,
    context: ToolHostContext,
    onUpdate?: (update: ToolExecutionUpdate) => Promise<void> | void
  ) => Promise<{ output: unknown; isError?: boolean; semantic?: ToolHostResult['semantic'] }>
  semantic?: (
    args: Record<string, unknown>,
    context: ToolHostContext,
    result: { output: unknown; isError?: boolean },
    call: ToolCallLike
  ) => ToolHostResult['semantic'] | undefined
  capabilityClass?: string
}

type CapabilityToolProvider = ToolProviderPolicy & {
  tools: readonly LocalTool[]
}

export type ActiveSkillsLookup = (skillId: string, context: ToolHostContext) => readonly string[]

export type SkillToolTemplate = 'bash' | 'read' | 'edit' | 'write' | 'grep' | 'find' | 'ls'

export type SkillToolExecutor = (
  template: SkillToolTemplate,
  args: Record<string, unknown>,
  context: ToolHostContext
) => Promise<{ output: unknown; isError?: boolean }>

/**
 * Build a single CapabilityToolProvider (kind: 'skill') that owns every
 * declarative tool across all skills. Each tool advertises only when its
 * owning skill is in the turn's activeSkillIds.
 *
 * Declarative tools execute by delegating to the template built-in tool via
 * the injected `executor`: the skill does not run its own code (design §5).
 * When no executor is supplied (e.g. in unit tests), execute returns a
 * descriptive message instead of running anything.
 */
export function buildSkillToolProvider(
  plugins: readonly LoadedSkillPlugin[],
  lookup: ActiveSkillsLookup,
  executor?: SkillToolExecutor
): CapabilityToolProvider {
  const tools: LocalTool[] = []
  for (const plugin of plugins) {
    for (const decl of plugin.manifest.tools.declarations) {
      tools.push(buildDeclarativeTool(plugin.id, decl, lookup, executor))
    }
  }
  return { id: 'skill', kind: 'skill', enabled: true, available: true, tools }
}

function buildDeclarativeTool(
  skillId: string,
  decl: LoadedSkillPlugin['manifest']['tools']['declarations'][number],
  lookup: ActiveSkillsLookup,
  executor?: SkillToolExecutor
): LocalTool {
  return {
    name: decl.name,
    description: decl.description,
    toolKind: 'tool_call',
    policy: decl.policy,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    shouldAdvertise: (context: ToolHostContext) => {
      const active = lookup(skillId, context)
      return active.includes(skillId)
    },
    execute: async (_args, context) => {
      if (executor) {
        return executor(decl.template, decl.args, context)
      }
      // No executor injected: describe what would run (unit-test / standalone use).
      const command = typeof decl.args.command === 'string' ? decl.args.command : ''
      if (decl.template === 'bash' && command) {
        return { output: `[skill:${skillId}:${decl.name}] would run: ${command}` }
      }
      return { output: `[skill:${skillId}:${decl.name}] template ${decl.template} has no executor` }
    }
  }
}
