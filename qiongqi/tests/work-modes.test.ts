import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CreateThreadRequest,
  QiongqiCapabilitiesConfig,
  StartTurnRequest
} from '@qiongqi/contracts'
import {
  DEFAULT_LOCKED_SKILL_IDS,
  assertSkillCanBeRemovedFromMode,
  resolveEffectiveSkillIds
} from '@qiongqi/skills'

const HERE = dirname(fileURLToPath(import.meta.url))

function skillDirectoryIds(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

function bundledCodingSkillIds(): string[] {
  const publicCodingRoot = resolve(HERE, '../../skills/public/coding')
  const qiongqiCodingRoot = resolve(HERE, '../skills')
  return [
    ...new Set([
      ...skillDirectoryIds(publicCodingRoot),
      ...skillDirectoryIds(qiongqiCodingRoot)
    ])
  ].sort((a, b) => a.localeCompare(b))
}

describe('work mode skill contracts', () => {
  it('ships locked core skills and default task/coding modes', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({})

    expect(cfg.skills.lockedSkillIds).toEqual(DEFAULT_LOCKED_SKILL_IDS)
    expect(cfg.skills.workModes.defaultModeId).toBe('task')
    expect(Object.keys(cfg.skills.workModes.modes).sort()).toEqual(['coding', 'task'])
  })

  it('enables every bundled coding skill in the coding work mode by default', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({})

    expect(cfg.skills.workModes.modes.coding?.defaultSkillIds.slice().sort()).toEqual(bundledCodingSkillIds())
  })

  it('merges bundled coding skills into stale persisted coding mode configs', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({
      skills: {
        workModes: {
          defaultModeId: 'task',
          modes: {
            task: {
              id: 'task',
              name: 'Task',
              builtin: true,
              editable: true,
              defaultSkillIds: ['deep-research']
            },
            coding: {
              id: 'coding',
              name: 'Coding',
              builtin: true,
              editable: true,
              defaultSkillIds: ['code-review']
            }
          }
        }
      }
    })

    expect(resolveEffectiveSkillIds(cfg.skills, 'coding').sort()).toEqual([
      ...new Set([
        ...DEFAULT_LOCKED_SKILL_IDS,
        ...bundledCodingSkillIds()
      ])
    ].sort((a, b) => a.localeCompare(b)))
  })

  it('accepts workModeId on thread and turn payloads', () => {
    expect(CreateThreadRequest.parse({
      title: 'x',
      workspace: '.',
      model: 'm',
      workModeId: 'coding'
    }).workModeId).toBe('coding')

    expect(StartTurnRequest.parse({
      prompt: 'ship it',
      workModeId: 'coding'
    }).workModeId).toBe('coding')
  })

  it('computes effective skills with locked skills winning over removals', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({
      skills: {
        workModes: {
          defaultModeId: 'research',
          modes: {
            research: {
              id: 'research',
              name: 'Research',
              builtin: false,
              editable: true,
              defaultSkillIds: ['deep-research']
            }
          }
        },
        modeSkillOverrides: {
          research: {
            addedSkillIds: ['xlsx-creator'],
            removedSkillIds: ['web', 'deep-research']
          }
        }
      }
    })

    expect(resolveEffectiveSkillIds(cfg.skills, 'research')).toEqual([
      'bootstrap',
      'find-skills',
      'goal',
      'skill-creator',
      'skill-manage',
      'todo',
      'web',
      'xlsx-creator'
    ])
  })

  it('rejects removing locked skills from a mode', () => {
    expect(() => assertSkillCanBeRemovedFromMode(DEFAULT_LOCKED_SKILL_IDS, 'web'))
      .toThrow(/required by all work modes/i)
  })
})
