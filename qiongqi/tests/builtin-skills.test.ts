import { describe, expect, it } from 'vitest'
import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SkillPluginHost } from '@qiongqi/skills'
import { SkillsCapabilityConfig } from '@qiongqi/contracts'
import { resolveBuiltinSkillRoots } from '@qiongqi/http'

const HERE = dirname(fileURLToPath(import.meta.url))

// The coding preset ships under <repo>/skills/ as a reference
// bundle. Qiongqi itself is domain-neutral and ships no skills by
// default; this preset is wired in explicitly via capabilities.skills
// in coding deployments.
//
// The skills root is resolved relative to this source file so the test
// works whether vitest is launched from the repo root or from a
// sub-package directory.
const PRESET_ROOT = [
  resolve(HERE, '../skills'),                 // from tests/ dir
  resolve(process.cwd(), 'skills'),           // from repo root
].find((candidate) => existsSync(candidate))!

const EXPECTED_IDS = [
  'code-review',
  'debugging',
  'git-worktrees',
  'goal',
  'planning',
  'refactoring',
  'review',
  'security-review',
  'tdd',
  'todo',
  'web'
]

describe('coding preset skills', () => {
  it('all coding-preset skills load and validate against v1 schema', async () => {
    const cfg = SkillsCapabilityConfig.parse({ enabled: true, roots: [] })
    const host = await SkillPluginHost.create(cfg, { builtinRoot: PRESET_ROOT })
    const ids = host.diagnostics().skills.map((s) => s.id).sort()
    const errors = host.diagnostics().validationErrors
    for (const id of EXPECTED_IDS) {
      expect(ids, `coding-preset skill ${id} should be discovered`).toContain(id)
    }
    expect(errors).toEqual([])
  })

  it('tdd is the full-capability reference skill (commands + declaration + contributes + permissions)', async () => {
    const cfg = SkillsCapabilityConfig.parse({ enabled: true, roots: [] })
    const host = await SkillPluginHost.create(cfg, { builtinRoot: PRESET_ROOT })
    const tdd = host.list().find((p) => p.id === 'tdd')
    expect(tdd, 'tdd skill must load').toBeDefined()
    expect(tdd!.manifest.commands.length).toBeGreaterThan(0)
    expect(tdd!.manifest.tools.declarations.map((d) => d.name)).toContain('run_tests')
    expect(tdd!.manifest.contributes.chatMenu.length).toBeGreaterThan(0)
    expect(tdd!.manifest.contributes.quickTask.length).toBeGreaterThan(0)
    expect(tdd!.manifest.permissions.exec).toBe('workspace')
    expect(tdd!.source).toBe('official')
  })

  it('no coding-preset skill is marked legacy', async () => {
    const cfg = SkillsCapabilityConfig.parse({ enabled: true, roots: [] })
    const host = await SkillPluginHost.create(cfg, { builtinRoot: PRESET_ROOT })
    for (const skill of host.diagnostics().skills) {
      expect(skill.legacy, `${skill.id} should not be legacy`).toBe(false)
    }
  })
})

describe('KWorks public lifecycle skills', () => {
  it('loads skill-creator, find-skills, and skill-manage from the KWorks public skill root', async () => {
    const publicRoot = [
      resolve(HERE, '../../../skills/public'),
      resolve(process.cwd(), '../skills/public'),
      resolve(process.cwd(), '../../skills/public'),
      resolve(process.cwd(), 'skills/public')
    ].find((candidate) => existsSync(candidate))!
    const cfg = SkillsCapabilityConfig.parse({ enabled: true, roots: [publicRoot], legacySkillMd: true })
    const host = await SkillPluginHost.create(cfg)
    const ids = host.diagnostics().skills.map((skill) => skill.id).sort()

    expect(ids).toContain('skill-creator')
    expect(ids).toContain('find-skills')
    expect(ids).toContain('skill-manage')
  })

  it('loads QiongQi coding preset skills together with KWorks lifecycle skills', async () => {
    const publicRoot = [
      resolve(HERE, '../../../skills/public'),
      resolve(process.cwd(), '../skills/public'),
      resolve(process.cwd(), '../../skills/public'),
      resolve(process.cwd(), 'skills/public')
    ].find((candidate) => existsSync(candidate))!
    const cfg = SkillsCapabilityConfig.parse({ enabled: true, roots: [publicRoot], legacySkillMd: true })
    const host = await SkillPluginHost.create(cfg, { builtinRoots: [PRESET_ROOT] })
    const ids = host.diagnostics().skills.map((skill) => skill.id).sort()

    expect(ids).toContain('tdd')
    expect(ids).toContain('code-review')
    expect(ids).toContain('skill-creator')
    expect(ids).toContain('find-skills')
    expect(ids).toContain('skill-manage')
  })
})

describe('KWorks unified skill roots', () => {
  it('prefers explicit KWorks roots without scanning stale third-party QiongQi fallbacks', async () => {
    const explicitRoot = [
      resolve(HERE, '../../../skills/public'),
      resolve(process.cwd(), '../skills/public'),
      resolve(process.cwd(), '../../skills/public'),
      resolve(process.cwd(), 'skills/public')
    ].find((candidate) => existsSync(candidate))!

    const roots = await resolveBuiltinSkillRoots('/tmp/kworks-no-data-dir', [explicitRoot])

    expect(roots).toEqual([explicitRoot])
    expect(roots.some((root) => root.includes('third_party/qiongqi/skills'))).toBe(false)
  })
})
