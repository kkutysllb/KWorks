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
const PUBLIC_CORE_SKILL_IDS = new Set(['bootstrap', 'find-skills', 'skill-creator', 'skill-manage'])

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

function bundledTaskSkillIds(): string[] {
  const publicRoot = resolve(HERE, '../../skills/public')
  return skillDirectoryIds(publicRoot)
    .filter((id) => id !== 'coding' && id !== 'finance' && !PUBLIC_CORE_SKILL_IDS.has(id))
}

describe('work mode skill contracts', () => {
  it('ships locked core skills and default task/coding modes', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({})

    expect(cfg.skills.lockedSkillIds).toEqual(DEFAULT_LOCKED_SKILL_IDS)
    expect(cfg.skills.workModes.defaultModeId).toBe('office')
    expect(Object.keys(cfg.skills.workModes.modes).sort()).toEqual(['coding', 'finance', 'office'])
  })

  it('enables every bundled coding skill in the coding work mode by default', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({})

    expect(cfg.skills.workModes.modes.coding?.defaultSkillIds.slice().sort()).toEqual(bundledCodingSkillIds())
  })

  it('enables every bundled public task skill in the office work mode by default', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({})

    expect(cfg.skills.workModes.modes.office?.defaultSkillIds.slice().sort()).toEqual(bundledTaskSkillIds())
  })

  it('finance mode distinguishes lightweight answers from full report deliverables', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({})
    const description = cfg.skills.workModes.modes.finance?.description ?? ''

    expect(description).toContain('短问快答、单指标查询、条件解释和轻量筛选')
    expect(description).toContain('完整分析、复盘、研究、回测和看板请求')
  })

  it('merges bundled coding skills into stale persisted coding mode configs', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({
      skills: {
        workModes: {
          defaultModeId: 'office',
          modes: {
            task: {
              id: 'office',
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

  it('merges bundled public task skills into stale persisted task mode configs', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({
      skills: {
        workModes: {
          defaultModeId: 'office',
          modes: {
            task: {
              id: 'office',
              name: 'Task',
              builtin: true,
              editable: true,
              defaultSkillIds: ['deep-research']
            }
          }
        }
      }
    })

    expect(resolveEffectiveSkillIds(cfg.skills, 'office').sort()).toEqual([
      ...new Set([
        ...DEFAULT_LOCKED_SKILL_IDS,
        ...bundledTaskSkillIds()
      ])
    ].sort((a, b) => a.localeCompare(b)))
  })

  it('accepts workModeId on thread and turn payloads', () => {
    expect(CreateThreadRequest.parse({
      title: 'x',
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

  it('restores built-in work mode defaults when stale overrides removed every default skill', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({
      skills: {
        modeSkillOverrides: {
          task: {
            addedSkillIds: [],
            removedSkillIds: [
              'data-analysis',
              'chart-visualization',
              'deep-research',
              'ppt-generation',
              'xlsx-creator',
              'pdf-processing'
            ]
          }
        }
      }
    })

    expect(resolveEffectiveSkillIds(cfg.skills, 'office')).toEqual(
      expect.arrayContaining([
        'data-analysis',
        'chart-visualization',
        'deep-research',
        'ppt-generation',
        'xlsx-creator',
        'pdf-processing'
      ])
    )
  })

  it('keeps built-in default skills enabled when stale overrides removed one default skill', () => {
    const cfg = QiongqiCapabilitiesConfig.parse({
      skills: {
        modeSkillOverrides: {
          task: {
            addedSkillIds: [],
            removedSkillIds: ['deep-research']
          }
        }
      }
    })

    expect(resolveEffectiveSkillIds(cfg.skills, 'office')).toEqual(
      expect.arrayContaining(['deep-research'])
    )
  })

  it('rejects removing locked skills from a mode', () => {
    expect(() => assertSkillCanBeRemovedFromMode(DEFAULT_LOCKED_SKILL_IDS, 'web'))
      .toThrow(/required by all work modes/i)
  })
})
