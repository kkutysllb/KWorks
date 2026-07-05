import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { dispatchRequest } from '@qiongqi/http'
import { buildHarness, readJson } from './http-server-test-harness.js'

const tempRoots: string[] = []
const execFileAsync = promisify(execFile)

describe('project APIs', () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('creates and persists a coding project for the runtime token', async () => {
    const h = buildHarness()
    const projectRoot = await mkdtemp(join(tmpdir(), 'qiongqi-project-'))
    await useTempDataDir(h)
    tempRoots.push(projectRoot)

    const create = await api(h, '/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Demo Project',
        path: projectRoot,
        description: 'coding workspace smoke test'
      })
    })

    expect(create.status).toBe(201)
    const project = await readJson(create) as {
      id: string
      name: string
      path: string
      description: string
      is_git_repo: boolean
    }
    expect(project).toMatchObject({
      name: 'Demo Project',
      path: projectRoot,
      description: 'coding workspace smoke test',
      is_git_repo: false
    })
    expect(project.id).toMatch(/^proj_/)

    const list = await api(h, '/api/projects')
    expect(list.status).toBe(200)
    await expect(readJson(list)).resolves.toMatchObject({
      projects: [expect.objectContaining({ id: project.id, path: projectRoot })]
    })

    const detail = await api(h, `/api/projects/${project.id}`)
    expect(detail.status).toBe(200)
    await expect(readJson(detail)).resolves.toMatchObject({
      id: project.id,
      name: 'Demo Project'
    })
  })

  it('stores runtime-token projects outside of user-scoped settings', async () => {
    const h = buildHarness()
    const projectRoot = await mkdtemp(join(tmpdir(), 'qiongqi-project-'))
    const dataDir = await useTempDataDir(h)
    tempRoots.push(projectRoot)
    const userDataStore = h.runtime.kworksUserDataStore!
    h.runtime.kworksUserDataStore = {
      ...userDataStore,
      async setUserSetting(userId: string, key: string, value: unknown) {
        if (userId === 'runtime') throw new Error('FOREIGN KEY constraint failed')
        await userDataStore.setUserSetting(userId, key, value)
      }
    }
    const create = await api(h, '/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Runtime Token Project',
        path: projectRoot
      })
    })

    expect(create.status).toBe(201)
    const project = await readJson(create) as { id: string; path: string }
    expect(project.path).toBe(projectRoot)

    const list = await api(h, '/api/projects')
    expect(list.status).toBe(200)
    await expect(readJson(list)).resolves.toMatchObject({
      projects: [expect.objectContaining({ id: project.id, name: 'Runtime Token Project' })]
    })
    const persisted = JSON.parse(await readFile(join(dataDir, 'kworks', 'projects.json'), 'utf-8')) as {
      users?: Record<string, unknown[]>
    }
    expect(persisted.users?.['internal-runtime']).toEqual([
      expect.objectContaining({ id: project.id, path: projectRoot })
    ])
  })

  it('lists project directories and reads file content', async () => {
    const h = buildHarness()
    const projectRoot = await mkdtemp(join(tmpdir(), 'qiongqi-project-'))
    await useTempDataDir(h)
    tempRoots.push(projectRoot)
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await writeFile(join(projectRoot, 'README.md'), '# Demo\n', 'utf-8')
    await writeFile(join(projectRoot, 'src', 'index.ts'), 'export const ok = true\n', 'utf-8')

    const create = await api(h, '/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'File Project',
        path: projectRoot
      })
    })
    const project = await readJson(create) as { id: string }

    const rootList = await api(h, `/api/projects/${project.id}/files?path=.`)
    expect(rootList.status).toBe(200)
    await expect(readJson(rootList)).resolves.toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ name: 'README.md', path: 'README.md', type: 'file', ext: '.md' }),
        expect.objectContaining({ name: 'src', path: 'src', type: 'directory', ext: '' })
      ])
    })

    const srcList = await api(h, `/api/projects/${project.id}/files?path=src`)
    expect(srcList.status).toBe(200)
    await expect(readJson(srcList)).resolves.toMatchObject({
      entries: [
        expect.objectContaining({ name: 'index.ts', path: 'src/index.ts', type: 'file', ext: '.ts' })
      ]
    })

    const readme = await api(h, `/api/projects/${project.id}/file?path=README.md`)
    expect(readme.status).toBe(200)
    await expect(readJson(readme)).resolves.toMatchObject({
      path: 'README.md',
      content: '# Demo\n',
      size: 7,
      language: 'markdown'
    })
  })

  it('returns stable empty project workspace data for a plain local directory', async () => {
    const h = buildHarness()
    const projectRoot = await mkdtemp(join(tmpdir(), 'qiongqi-project-'))
    await useTempDataDir(h)
    tempRoots.push(projectRoot)

    const create = await api(h, '/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Plain Project',
        path: projectRoot
      })
    })
    const project = await readJson(create) as { id: string }

    const worktrees = await api(h, `/api/projects/${project.id}/worktrees`)
    expect(worktrees.status).toBe(200)
    await expect(readJson(worktrees)).resolves.toEqual({ worktrees: [] })

    const diff = await api(h, `/api/projects/${project.id}/diff`)
    expect(diff.status).toBe(200)
    await expect(readJson(diff)).resolves.toMatchObject({
      is_git_repo: false,
      has_changes: false,
      files: [],
      diff: ''
    })

    const environment = await api(h, `/api/projects/${project.id}/environment`)
    expect(environment.status).toBe(200)
    await expect(readJson(environment)).resolves.toMatchObject({
      is_git_repo: false,
      branch: null,
      head: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      changed_files: 0,
      additions: 0,
      deletions: 0,
      source: { label: projectRoot, remote: null, provider: 'local' }
    })

    const changes = await api(h, `/api/coding/sessions/${project.id}/changes`)
    expect(changes.status).toBe(200)
    await expect(readJson(changes)).resolves.toEqual({
      thread_id: project.id,
      changes: []
    })
  })

  it('returns utf-8 paths for changed files with Chinese filenames', async () => {
    const h = buildHarness()
    const projectRoot = await mkdtemp(join(tmpdir(), 'qiongqi-project-'))
    await useTempDataDir(h)
    tempRoots.push(projectRoot)
    await git(projectRoot, 'init')
    await git(projectRoot, 'config', 'user.email', 'test@example.com')
    await git(projectRoot, 'config', 'user.name', 'Test User')
    await mkdir(join(projectRoot, '.qiongqisdd', 'plan'), { recursive: true })
    const relativePath = join('.qiongqisdd', 'plan', 'skills-项目分析.md')
    await writeFile(join(projectRoot, relativePath), '初始内容\n', 'utf8')
    await git(projectRoot, 'add', '.')
    await git(projectRoot, 'commit', '-m', 'initial')
    await writeFile(join(projectRoot, relativePath), '初始内容\n新增内容\n', 'utf8')
    const status = await execFileAsync('git', ['-c', 'core.quotePath=false', 'status', '--porcelain'], { cwd: projectRoot })
    expect(status.stdout).toContain(relativePath)

    const create = await api(h, '/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'UTF8 Project',
        path: projectRoot
      })
    })
    const project = await readJson(create) as { id: string }

    const diff = await api(h, `/api/projects/${project.id}/diff`)
    expect(diff.status).toBe(200)
    const diffBody = await readJson(diff) as {
      files: Array<{ path: string; additions: number; deletions: number }>
    }
    expect(diffBody.files).toEqual([
      expect.objectContaining({
        path: relativePath,
        additions: 1,
        deletions: 0
      })
    ])
  })

  it('returns stable coding workbench inspector data for legacy panels', async () => {
    const h = buildHarness()
    const projectRoot = await mkdtemp(join(tmpdir(), 'qiongqi-project-'))
    await useTempDataDir(h)
    tempRoots.push(projectRoot)

    const create = await api(h, '/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Inspector Project',
        path: projectRoot
      })
    })
    const project = await readJson(create) as { id: string }

    const stages = await api(h, '/api/coding/delivery-stages')
    expect(stages.status).toBe(200)
    await expect(readJson(stages)).resolves.toMatchObject({
      stages: expect.arrayContaining([
        expect.objectContaining({
          id: 'requirements',
          recommended_skills: expect.arrayContaining(['requirements-analysis'])
        }),
        expect.objectContaining({
          id: 'implementation',
          next_stage_id: 'review'
        })
      ])
    })

    const initialStage = await api(h, `/api/coding/stage?project_root=${encodeURIComponent(projectRoot)}`)
    expect(initialStage.status).toBe(200)
    await expect(readJson(initialStage)).resolves.toMatchObject({
      project_root: projectRoot,
      current_stage: null,
      stage_history: [],
      pending_suggestion: null
    })

    const setStage = await api(h, `/api/coding/stage?project_root=${encodeURIComponent(projectRoot)}`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: 'implementation', reason: 'Start coding' })
    })
    expect(setStage.status).toBe(200)
    await expect(readJson(setStage)).resolves.toMatchObject({
      project_root: projectRoot,
      current_stage: 'implementation',
      stage_history: [
        expect.objectContaining({
          from_stage_id: null,
          to_stage_id: 'implementation',
          reason: 'Start coding',
          source: 'user'
        })
      ]
    })

    for (const path of [
      `/api/coding/sessions/${project.id}`,
      `/api/coding/sessions/${project.id}/events`,
      `/api/coding/sessions/${project.id}/review`,
      `/api/coding/sessions/${project.id}/roi/summary`,
      `/api/coding/sessions/${project.id}/roi`
    ]) {
      const response = await api(h, path)
      expect(response.status, path).toBe(200)
    }

    await expect(readJson(await api(h, `/api/coding/sessions/${project.id}`))).resolves.toMatchObject({
      thread_id: project.id,
      session: {
        thread_id: project.id,
        project_root: null,
        active_coding_skills: [],
        tool_policy: [],
        change_summary: {},
        updated_at: null
      }
    })
    await expect(readJson(await api(h, `/api/coding/sessions/${project.id}/events`))).resolves.toEqual({
      thread_id: project.id,
      events: []
    })
    await expect(readJson(await api(h, `/api/coding/sessions/${project.id}/review`))).resolves.toEqual({
      thread_id: project.id,
      review: null
    })
    await expect(readJson(await api(h, `/api/coding/sessions/${project.id}/roi`))).resolves.toEqual({
      thread_id: project.id,
      reports: []
    })
  })

  it('returns stable responses for legacy coding git buttons on non-git projects', async () => {
    const h = buildHarness()
    const projectRoot = await mkdtemp(join(tmpdir(), 'qiongqi-project-'))
    await useTempDataDir(h)
    tempRoots.push(projectRoot)

    const create = await api(h, '/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Plain Buttons Project',
        path: projectRoot
      })
    })
    const project = await readJson(create) as { id: string }

    const discard = await api(h, `/api/projects/${project.id}/diff/discard`, {
      method: 'POST',
      body: JSON.stringify({ path: 'README.md' })
    })
    expect(discard.status).toBe(400)
    await expect(readJson(discard)).resolves.toMatchObject({
      detail: 'Project is not a git repository'
    })

    const commit = await api(h, `/api/projects/${project.id}/git/commit`, {
      method: 'POST',
      body: JSON.stringify({ message: 'test commit' })
    })
    expect(commit.status).toBe(400)
    await expect(readJson(commit)).resolves.toMatchObject({
      detail: 'Project is not a git repository'
    })

    const push = await api(h, `/api/projects/${project.id}/git/push`, { method: 'POST' })
    expect(push.status).toBe(400)
    await expect(readJson(push)).resolves.toMatchObject({
      detail: 'Project is not a git repository'
    })
  })

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

  async function useTempDataDir(h: ReturnType<typeof buildHarness>): Promise<string> {
    const dataDir = await mkdtemp(join(tmpdir(), 'qiongqi-runtime-data-'))
    tempRoots.push(dataDir)
    const originalInfo = h.runtime.info
    h.runtime.info = () => ({ ...originalInfo(), dataDir })
    return dataDir
  }

  async function git(cwd: string, ...args: string[]): Promise<void> {
    await execFileAsync('git', args, { cwd })
  }
})
