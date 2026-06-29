import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { dispatchRequest } from '@qiongqi/http'
import { buildHarness, readJson } from './http-server-test-harness.js'

describe('work mode skill APIs', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    tempDirs.length = 0
  })

  it('lists built-in work modes with effective skill state', async () => {
    const h = buildSkillHarness()

    const response = await api(h, '/api/work-modes')

    expect(response.status).toBe(200)
    const body = await readJson(response) as {
      workModes: Array<{
        id: string
        builtin: boolean
        editable: boolean
        skills: Array<{ id: string; enabled: boolean; locked: boolean }>
      }>
    }
    expect(body.workModes.map((mode) => mode.id).sort()).toEqual(['coding', 'task'])
    expect(body.workModes.find((mode) => mode.id === 'task')).toMatchObject({
      builtin: true,
      editable: true
    })
    expect(body.workModes.find((mode) => mode.id === 'task')?.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'web', enabled: true, locked: true }),
        expect.objectContaining({ id: 'xlsx-creator', enabled: true, locked: false })
      ])
    )
  })

  it('rejects deleting built-in work modes and locked mode skills', async () => {
    const h = buildSkillHarness()

    const deleteMode = await api(h, '/api/work-modes/task', { method: 'DELETE' })
    expect(deleteMode.status).toBe(403)

    const removeLockedSkill = await api(h, '/api/work-modes/task/skills/web', { method: 'DELETE' })
    expect(removeLockedSkill.status).toBe(403)
  })

  it('adds and removes mode-scoped skills', async () => {
    const h = buildSkillHarness()

    const add = await api(h, '/api/work-modes/task/skills/custom-research', { method: 'PUT' })
    expect(add.status).toBe(200)
    await expect(readJson(add)).resolves.toMatchObject({
      workMode: {
        id: 'task',
        skills: expect.arrayContaining([
          expect.objectContaining({ id: 'custom-research', enabled: true })
        ])
      }
    })

    const remove = await api(h, '/api/work-modes/task/skills/xlsx-creator', { method: 'DELETE' })
    expect(remove.status).toBe(200)
    await expect(readJson(remove)).resolves.toMatchObject({
      workMode: {
        id: 'task',
        skills: expect.arrayContaining([
          expect.objectContaining({ id: 'xlsx-creator', enabled: false })
        ])
      }
    })
  })

  it('creates, updates, binds skills to, and deletes custom work modes', async () => {
    const h = buildSkillHarness()

    const create = await api(h, '/api/work-modes', {
      method: 'POST',
      body: JSON.stringify({
        id: 'finance-review',
        name: '财经研判',
        description: '跟踪公司公告、研报和市场数据',
        icon: 'chart'
      })
    })

    expect(create.status).toBe(201)
    await expect(readJson(create)).resolves.toMatchObject({
      workMode: {
        id: 'finance-review',
        name: '财经研判',
        description: '跟踪公司公告、研报和市场数据',
        builtin: false,
        editable: true,
        skills: expect.arrayContaining([
          expect.objectContaining({ id: 'web', enabled: true, locked: true })
        ])
      }
    })

    const update = await api(h, '/api/work-modes/finance-review', {
      method: 'PATCH',
      body: JSON.stringify({
        name: '财经分析',
        description: '分析公告、研报和市场数据',
        icon: 'newspaper'
      })
    })
    expect(update.status).toBe(200)
    await expect(readJson(update)).resolves.toMatchObject({
      workMode: {
        id: 'finance-review',
        name: '财经分析',
        description: '分析公告、研报和市场数据',
        icon: 'newspaper'
      }
    })

    const addSkill = await api(h, '/api/work-modes/finance-review/skills/custom-research', { method: 'PUT' })
    expect(addSkill.status).toBe(200)
    await expect(readJson(addSkill)).resolves.toMatchObject({
      workMode: {
        id: 'finance-review',
        skills: expect.arrayContaining([
          expect.objectContaining({ id: 'custom-research', enabled: true, locked: false })
        ])
      }
    })

    const list = await api(h, '/api/work-modes')
    expect(list.status).toBe(200)
    const listed = await readJson(list) as { workModes: Array<{ id: string; name: string; builtin: boolean }> }
    expect(listed.workModes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'task', builtin: true }),
      expect.objectContaining({ id: 'coding', builtin: true }),
      expect.objectContaining({ id: 'finance-review', name: '财经分析', builtin: false })
    ]))

    const remove = await api(h, '/api/work-modes/finance-review', { method: 'DELETE' })
    expect(remove.status).toBe(200)

    const afterDelete = await api(h, '/api/work-modes')
    const body = await readJson(afterDelete) as { workModes: Array<{ id: string }> }
    expect(body.workModes.map((mode) => mode.id).sort()).toEqual(['coding', 'task'])
  })

  it('requires custom work modes to have an agent instruction and a simple lowercase id', async () => {
    const h = buildSkillHarness()

    const missingDescription = await api(h, '/api/work-modes', {
      method: 'POST',
      body: JSON.stringify({
        id: 'finance-review',
        name: '财经研判',
        icon: 'chart'
      })
    })
    expect(missingDescription.status).toBe(400)
    await expect(readJson(missingDescription)).resolves.toMatchObject({
      detail: 'description is required'
    })

    const missingId = await api(h, '/api/work-modes', {
      method: 'POST',
      body: JSON.stringify({
        name: '财经研判',
        description: '分析公告、研报和市场数据',
        icon: 'chart'
      })
    })
    expect(missingId.status).toBe(400)
    await expect(readJson(missingId)).resolves.toMatchObject({
      detail: 'id is required'
    })

    const invalidId = await api(h, '/api/work-modes', {
      method: 'POST',
      body: JSON.stringify({
        id: 'finance_review.v1',
        name: '财经研判',
        description: '分析公告、研报和市场数据',
        icon: 'chart'
      })
    })
    expect(invalidId.status).toBe(400)
    await expect(readJson(invalidId)).resolves.toMatchObject({
      detail: 'id must start with a lowercase English letter or number and contain only lowercase English letters, numbers, or hyphens'
    })
  })

  it('rejects clearing the agent instruction when updating custom work modes', async () => {
    const h = buildSkillHarness()

    const create = await api(h, '/api/work-modes', {
      method: 'POST',
      body: JSON.stringify({
        id: 'finance-review',
        name: '财经研判',
        description: '分析公告、研报和市场数据',
        icon: 'chart'
      })
    })
    expect(create.status).toBe(201)

    const clearDescription = await api(h, '/api/work-modes/finance-review', {
      method: 'PATCH',
      body: JSON.stringify({
        description: ''
      })
    })
    expect(clearDescription.status).toBe(400)
    await expect(readJson(clearDescription)).resolves.toMatchObject({
      detail: 'description is required'
    })
  })

  it('keeps /api/coding/skills as a coding mode compatibility route', async () => {
    const h = buildSkillHarness()

    const response = await api(h, '/api/coding/skills')

    expect(response.status).toBe(200)
    await expect(readJson(response)).resolves.toMatchObject({
      skills: expect.arrayContaining([
        expect.objectContaining({
          id: 'tdd',
          enabled: true,
          scope: 'global',
          activation_keywords: [],
          allowed_tools: [],
          manifest_errors: []
        }),
        expect.objectContaining({
          id: 'xlsx-creator',
          enabled: false,
          activation_keywords: []
        })
      ])
    })
  })

  it('updates coding mode skills through the legacy coding skill toggle route', async () => {
    const h = buildSkillHarness()

    const enable = await api(h, '/api/coding/skills/xlsx-creator/enabled', {
      method: 'PUT',
      body: JSON.stringify({ scope: 'global', enabled: true })
    })
    expect(enable.status).toBe(200)
    await expect(readJson(enable)).resolves.toMatchObject({
      skill: {
        id: 'xlsx-creator',
        enabled: true,
        activation_keywords: []
      },
      instructions: ''
    })

    const list = await api(h, '/api/coding/skills')
    expect(list.status).toBe(200)
    await expect(readJson(list)).resolves.toMatchObject({
      skills: expect.arrayContaining([
        expect.objectContaining({ id: 'xlsx-creator', enabled: true })
      ])
    })
  })

  it('installs generated skill artifacts into the user skill root and binds them to the selected work mode', async () => {
    const h = buildSkillHarness()
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'kun-skill-workspace-'))
    tempDirs.push(workspaceRoot)
    const dataDir = join(workspaceRoot, 'users', 'runtime')
    const originalInfo = h.runtime.info()
    h.runtime.info = () => ({
      ...originalInfo,
      dataDir
    })
    await mkdir(join(dataDir, 'threads', 'thread_skill_create', 'outputs'), { recursive: true })
    await writeFile(
      join(dataDir, 'threads', 'thread_skill_create', 'outputs', 'stock-scout.skill'),
      [
        '---',
        'name: stock-scout',
        'description: 跟踪股票公告和市场数据',
        '---',
        '',
        '# Stock Scout',
        '',
        'Use market files and web research to summarize signals.',
        ''
      ].join('\n'),
      'utf8'
    )

    const install = await api(h, '/api/skills/install', {
      method: 'POST',
      body: JSON.stringify({
        thread_id: 'thread_skill_create',
        path: '/mnt/qiongqi/outputs/stock-scout.skill',
        workModeId: 'coding'
      })
    })

    expect(install.status).toBe(200)
    await expect(readJson(install)).resolves.toMatchObject({
      success: true,
      skill_name: 'stock-scout',
      workModeId: 'coding'
    })
    const installedSkillPath = join(dataDir, 'skills', 'custom', 'shared', 'stock-scout', 'SKILL.md')
    const unifiedSkillPath = join(workspaceRoot, 'skills', 'custom', 'shared', 'stock-scout', 'SKILL.md')
    await expect(readFile(unifiedSkillPath, 'utf8')).resolves.toContain('# Stock Scout')
    await expect(readFile(installedSkillPath, 'utf8')).rejects.toThrow()

    const modes = await api(h, '/api/work-modes/coding/skills')
    expect(modes.status).toBe(200)
    await expect(readJson(modes)).resolves.toMatchObject({
      skills: expect.arrayContaining([
        expect.objectContaining({ id: 'stock-scout', enabled: true })
      ])
    })
  })

  it('returns work mode id in compatibility thread state', async () => {
    const h = buildSkillHarness()

    const create = await api(h, '/api/threads', {
      method: 'POST',
      body: JSON.stringify({
        thread_id: 'thread-custom-mode',
        title: 'Custom mode thread',
        workModeId: 'coding'
      })
    })
    expect(create.status).toBe(200)

    const state = await api(h, '/api/threads/thread-custom-mode/state')
    expect(state.status).toBe(200)
    await expect(readJson(state)).resolves.toMatchObject({
      values: {
        title: 'Custom mode thread',
        workModeId: 'coding'
      }
    })
  })

  it('rejects disabling locked skills globally', async () => {
    const h = buildSkillHarness()

    const response = await api(h, '/api/skills/web', {
      method: 'PUT',
      body: JSON.stringify({ enabled: false })
    })

    expect(response.status).toBe(403)

    const deleteResponse = await api(h, '/api/skills/web', { method: 'DELETE' })
    expect(deleteResponse.status).toBe(403)
  })

  function buildSkillHarness() {
    const h = buildHarness()
    h.runtime.skillsV2 = () => ({
      enabled: true,
      roots: ['/tmp/skills/public'],
      skills: [
        skill('web', 'workflow'),
        skill('xlsx-creator', 'workflow'),
        skill('custom-research', 'workflow'),
        skill('tdd', 'development')
      ],
      validationErrors: [],
      lastActivations: []
    })
    return h
  }

  function skill(id: string, category: string) {
    return {
      id,
      name: id,
      version: '1.0.0',
      root: `/tmp/skills/public/${id}`,
      legacy: true,
      source: 'official',
      category,
      commands: [],
      contributions: { chatMenu: [], quickTask: [] },
      permissions: { workspace: 'write', network: false, exec: 'workspace' },
      triggers: { commands: [], promptPatterns: [], fileTypes: [] },
      allowedTools: []
    }
  }

  function api(h: ReturnType<typeof buildHarness>, path: string, init: RequestInit = {}) {
    return dispatchRequest(h.router, new Request(`http://localhost${path}`, {
      ...init,
      headers: {
        authorization: 'Bearer tok-1',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers
      }
    }))
  }
})
