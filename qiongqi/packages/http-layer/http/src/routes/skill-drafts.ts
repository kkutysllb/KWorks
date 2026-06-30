import { createHash, randomUUID } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import {
  DEFAULT_QIONGQI_CAPABILITIES_CONFIG,
  QiongqiConfigSchema,
  type QiongqiConfig
} from '@qiongqi/contracts'
import { resolveWorkModeDefaultSkillIds } from '@qiongqi/skills'
import type { AuthActor } from '../auth-service.js'
import { readJsonBody } from '../read-json-body.js'
import { jsonResponse, type JsonResponse } from '../response.js'
import { ERRORS } from './runtime-error.js'
import type { ServerRuntime } from './server-runtime.js'

type DraftMode = 'scripts' | 'package'
type SkillDraftFormValue = string | File

type DraftFile = {
  path: string
  kind: string
  size: number
  sha256?: string
}

type SkillDraftSnapshot = {
  version: 1
  draftId: string
  mode: DraftMode
  workModeId?: string
  createdAt: string
  updatedAt: string
  files: DraftFile[]
  evidence?: SkillDraftEvidence
  draft?: GeneratedSkillDraft
}

type EntryCandidate = {
  path: string
  confidence: number
  reason: string
}

type CommandArgument = {
  name: string
  required: boolean
  source: string
}

type CommandEvidence = {
  path: string
  suggestedInvocation: string
  arguments: CommandArgument[]
}

type DependencyEvidence = {
  name: string
  source: string
}

type RiskEvidence = {
  severity: 'low' | 'medium' | 'high'
  kind: string
  evidence: string
}

type SnippetEvidence = {
  path: string
  label: string
  text: string
}

type SkillDraftEvidence = {
  files: DraftFile[]
  entryCandidates: EntryCandidate[]
  commands: CommandEvidence[]
  dependencies: DependencyEvidence[]
  risks: RiskEvidence[]
  snippets: SnippetEvidence[]
}

type GeneratedSkillDraft = {
  metadata: {
    id: string
    name: string
    description: string
  }
  skillMarkdown: string
  manifestPatch: Record<string, unknown>
  questions: Array<{ field: string; question: string }>
  warnings: Array<{ severity: string; message: string }>
}

const SCRIPT_EXTENSIONS = new Set(['.py', '.sh', '.js', '.ts', '.mjs', '.cjs'])
const MAX_UPLOAD_BYTES = 512 * 1024

export async function createSkillDraft(
  runtime: ServerRuntime,
  _actor: AuthActor | undefined,
  request: Request
): Promise<JsonResponse | Response> {
  const form = await request.formData().catch(() => null)
  if (!form) return ERRORS.validation('skill draft request must be multipart/form-data')
  const values = form.getAll('files')
  const files = values.filter((value): value is File => value instanceof File)
  if (files.length === 0) return ERRORS.validation('at least one file is required')

  const draftId = `draft_${randomUUID().replace(/-/g, '').slice(0, 16)}`
  const root = draftRoot(runtime, draftId)
  const filesRoot = join(root, 'files')
  await mkdir(filesRoot, { recursive: true })

  const uploaded: DraftFile[] = []
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return ERRORS.validation(`file exceeds ${MAX_UPLOAD_BYTES} byte limit: ${file.name}`)
    }
    const safePath = safeUploadPath(file.name || 'upload')
    if (!safePath.ok) return ERRORS.validation(safePath.detail)
    const absolutePath = resolve(filesRoot, safePath.path)
    const rel = relative(filesRoot, absolutePath)
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
      return ERRORS.validation('uploaded file path escapes draft workspace')
    }
    await mkdir(dirname(absolutePath), { recursive: true })
    const data = Buffer.from(await file.arrayBuffer())
    await writeFile(absolutePath, data)
    uploaded.push({
      path: safePath.path,
      kind: kindForPath(safePath.path),
      size: data.byteLength,
      sha256: createHash('sha256').update(data).digest('hex')
    })
  }

  const now = runtime.nowIso()
  const draft: SkillDraftSnapshot = {
    version: 1,
    draftId,
    mode: draftMode(form.get('mode')),
    workModeId: normalizeWorkModeId(stringFormValue(form.get('workModeId')) ?? stringFormValue(form.get('work_mode_id'))),
    createdAt: now,
    updatedAt: now,
    files: uploaded
  }
  await saveDraft(runtime, draft)

  return jsonResponse({
    success: true,
    draftId,
    mode: draft.mode,
    files: uploaded.map(({ sha256: _sha256, ...file }) => file)
  }, 201)
}

export async function analyzeSkillDraft(
  runtime: ServerRuntime,
  _actor: AuthActor | undefined,
  draftId: string
): Promise<JsonResponse | Response> {
  const draft = await loadDraft(runtime, draftId)
  if (!draft) return ERRORS.notFound(`skill draft not found: ${draftId}`)
  const evidence = await analyzeDraftFiles(runtime, draft)
  const next = { ...draft, evidence, updatedAt: runtime.nowIso() }
  await saveDraft(runtime, next)
  return jsonResponse({ success: true, draftId, evidence })
}

export async function generateSkillDraft(
  runtime: ServerRuntime,
  _actor: AuthActor | undefined,
  draftId: string
): Promise<JsonResponse | Response> {
  const draft = await loadDraft(runtime, draftId)
  if (!draft) return ERRORS.notFound(`skill draft not found: ${draftId}`)
  const evidence = draft.evidence ?? await analyzeDraftFiles(runtime, draft)
  const generated = generateDraftFromEvidence(evidence)
  await saveDraft(runtime, {
    ...draft,
    evidence,
    draft: generated,
    updatedAt: runtime.nowIso()
  })
  return jsonResponse({ success: true, draftId, evidence, draft: generated })
}

export async function updateSkillDraft(
  runtime: ServerRuntime,
  _actor: AuthActor | undefined,
  draftId: string,
  request: Request
): Promise<JsonResponse | Response> {
  const draft = await loadDraft(runtime, draftId)
  if (!draft) return ERRORS.notFound(`skill draft not found: ${draftId}`)
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  if (!isObject(body.value)) return jsonResponse({ detail: 'skill draft update body must be an object' }, 400)
  const nextDraft = parseGeneratedDraft(body.value.draft) ?? draft.draft
  const next: SkillDraftSnapshot = {
    ...draft,
    ...(nextDraft ? { draft: nextDraft } : {}),
    updatedAt: runtime.nowIso()
  }
  await saveDraft(runtime, next)
  return jsonResponse({ success: true, draftId, draft: next.draft })
}

export async function installSkillDraft(
  runtime: ServerRuntime,
  actor: AuthActor | undefined,
  draftId: string,
  request: Request
): Promise<JsonResponse | Response> {
  const draft = await loadDraft(runtime, draftId)
  if (!draft) return ERRORS.notFound(`skill draft not found: ${draftId}`)
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  if (!isObject(body.value)) return jsonResponse({ detail: 'skill draft install body must be an object' }, 400)

  const generated = parseGeneratedDraft(body.value) ?? draft.draft
  if (!generated) return jsonResponse({ detail: 'skill draft has not been generated' }, 400)
  const skillId = generated.metadata.id.trim()
  if (!isValidCustomSkillId(skillId)) {
    return jsonResponse({ detail: 'id must start with a lowercase English letter or number and contain only lowercase English letters, numbers, or hyphens' }, 400)
  }
  if (containsUnsafeAbsolutePath(generated.skillMarkdown)) {
    return jsonResponse({ detail: 'generated SKILL.md contains an absolute local path' }, 400)
  }

  const targetRoot = userSkillInstallRoot(runtime, skillId)
  await rm(targetRoot, { recursive: true, force: true })
  await mkdir(join(targetRoot, 'scripts'), { recursive: true })
  for (const file of draft.files) {
    const source = resolve(draftFilesRoot(runtime, draft.draftId), file.path)
    const targetName = basename(file.path)
    await cp(source, join(targetRoot, 'scripts', targetName), { recursive: false, force: true })
  }
  await writeFile(join(targetRoot, 'SKILL.md'), generated.skillMarkdown, 'utf8')
  await writeFile(join(targetRoot, 'skill.json'), `${JSON.stringify(skillManifestForDraft(generated), null, 2)}\n`, 'utf8')

  const requestedWorkModeId = normalizeWorkModeId(stringValue(body.value.workModeId) ?? stringValue(body.value.work_mode_id) ?? draft.workModeId)
  const registered = await enableDraftSkillForActor(runtime, actor, skillId, requestedWorkModeId)
  if (!registered.ok) return registered.response

  return jsonResponse({
    success: true,
    installed: true,
    skill_name: skillId,
    skill_id: skillId,
    workModeId: registered.workModeId,
    root: targetRoot,
    message: `技能 ${skillId} 已安装并绑定到 ${registered.workModeId}`
  }, 201)
}

async function analyzeDraftFiles(runtime: ServerRuntime, draft: SkillDraftSnapshot): Promise<SkillDraftEvidence> {
  const files: DraftFile[] = []
  const entryCandidates: EntryCandidate[] = []
  const commands: CommandEvidence[] = []
  const dependencies = new Map<string, DependencyEvidence>()
  const risks: RiskEvidence[] = []
  const snippets: SnippetEvidence[] = []

  for (const file of draft.files) {
    const absolutePath = resolve(draftFilesRoot(runtime, draft.draftId), file.path)
    const content = await readFile(absolutePath, 'utf8').catch(() => '')
    files.push(file)
    if (!SCRIPT_EXTENSIONS.has(extname(file.path).toLowerCase())) continue

    const kind = kindForPath(file.path)
    const args = extractArguments(content)
    const hasMain = /if\s+__name__\s*==\s*['"]__main__['"]/.test(content)
    const hasArgparse = /\bargparse\b|ArgumentParser|add_argument/.test(content)
    const confidence = hasMain && hasArgparse ? 0.86 : hasArgparse ? 0.7 : 0.5
    const reasons = [
      hasMain ? 'has __main__ guard' : undefined,
      hasArgparse ? 'argparse definitions' : undefined,
      !hasMain && !hasArgparse ? `${kind} script file` : undefined
    ].filter(Boolean).join(' and ')
    entryCandidates.push({ path: file.path, confidence, reason: reasons })
    commands.push({
      path: file.path,
      suggestedInvocation: invocationFor(file.path, args),
      arguments: args.map((name) => ({ name, required: true, source: hasArgparse ? 'argparse positional' : 'script heuristic' }))
    })

    for (const dependency of extractDependencies(content, kind)) {
      dependencies.set(dependency.name, dependency)
    }
    risks.push(...extractRisks(content))
    const snippet = content.split(/\r?\n/).filter((line) => /ArgumentParser|add_argument|if\s+__name__/.test(line)).slice(0, 8).join('\n')
    if (snippet) snippets.push({ path: file.path, label: 'cli section', text: snippet })
  }

  entryCandidates.sort((a, b) => b.confidence - a.confidence || a.path.localeCompare(b.path))
  commands.sort((a, b) => a.path.localeCompare(b.path))
  return {
    files,
    entryCandidates,
    commands,
    dependencies: [...dependencies.values()].sort((a, b) => a.name.localeCompare(b.name)),
    risks,
    snippets
  }
}

function generateDraftFromEvidence(evidence: SkillDraftEvidence): GeneratedSkillDraft {
  const command = evidence.commands[0]
  const entry = evidence.entryCandidates[0]
  const base = basename(command?.path ?? entry?.path ?? evidence.files[0]?.path ?? 'skill', extname(command?.path ?? entry?.path ?? evidence.files[0]?.path ?? ''))
  const id = slugifySkillId(base) ?? 'script-skill'
  const title = titleFromSlug(id)
  const description = descriptionFromEvidence(evidence, title)
  const invocation = command?.suggestedInvocation ?? `python scripts/${basename(entry?.path ?? 'script.py')}`
  const warnings = evidence.risks.map((risk) => ({ severity: risk.severity, message: `${risk.kind}: ${risk.evidence}` }))
  const questions = command && command.arguments.length > 0
    ? []
    : [{ field: 'arguments', question: 'Confirm the required command arguments before using this skill.' }]
  const skillMarkdown = [
    '---',
    `name: ${id}`,
    `description: ${frontmatterLine(description)}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## When To Use',
    `Use when the user needs to run the bundled ${title} script workflow.`,
    '',
    '## Procedure',
    '- Confirm the input files, output path, and any user-specific constraints before running the script.',
    `- Run the bundled command with package-relative paths:`,
    '',
    '```bash',
    invocation,
    '```',
    '- Review the command output and report any missing dependencies or script errors clearly.',
    '',
    '## Output Contract',
    '- Provide the generated file path or command output.',
    '- Summarize what the script did and list any warnings or follow-up actions.',
    ...(warnings.length
      ? [
          '',
          '## Warnings',
          ...warnings.map((warning) => `- ${warning.message}`)
        ]
      : [])
  ].join('\n')

  return {
    metadata: { id, name: title, description },
    skillMarkdown,
    manifestPatch: {
      category: 'workflow',
      permissions: {
        workspace: 'write',
        network: evidence.risks.some((risk) => risk.kind === 'network'),
        exec: 'workspace',
        requiresApproval: 'on-request'
      },
      assets: evidence.files.map((file) => `scripts/${basename(file.path)}`)
    },
    questions,
    warnings
  }
}

function skillManifestForDraft(draft: GeneratedSkillDraft): Record<string, unknown> {
  const permissions = isObject(draft.manifestPatch.permissions)
    ? draft.manifestPatch.permissions
    : {
        workspace: 'write',
        network: false,
        exec: 'workspace',
        requiresApproval: 'on-request'
      }
  const assets = Array.isArray(draft.manifestPatch.assets)
    ? draft.manifestPatch.assets.filter((asset): asset is string => typeof asset === 'string')
    : []
  return {
    specVersion: '1.0',
    id: draft.metadata.id,
    name: draft.metadata.name,
    description: draft.metadata.description,
    version: '0.1.0',
    entry: 'SKILL.md',
    category: 'workflow',
    activation: {
      commands: [],
      promptPatterns: [escapeRegExp(draft.metadata.description)],
      fileTypes: [],
      autoActivate: false
    },
    commands: [],
    tools: {
      allowed: [],
      declarations: [],
      mcpServers: {}
    },
    contributes: {
      chatMenu: [],
      quickTask: []
    },
    permissions,
    assets
  }
}

async function enableDraftSkillForActor(
  runtime: ServerRuntime,
  actor: AuthActor | undefined,
  skillId: string,
  requestedWorkModeId: string | undefined
): Promise<{ ok: true; workModeId: string } | { ok: false; response: JsonResponse }> {
  const current = await readEffectiveConfig(runtime, actor)
  const currentSkills = current.capabilities?.skills ?? DEFAULT_QIONGQI_CAPABILITIES_CONFIG.skills
  const installRoot = customSharedSkillRoot(runtime)
  const roots = new Set(currentSkills.roots ?? [])
  roots.add(installRoot)
  const withRoot = {
    ...currentSkills,
    enabled: true,
    roots: [...roots].sort((a, b) => a.localeCompare(b)),
    enabledSkills: {
      ...(currentSkills.enabledSkills ?? {}),
      [skillId]: true
    }
  }
  const workModeId = requestedWorkModeId && withRoot.workModes.modes[requestedWorkModeId]
    ? requestedWorkModeId
    : withRoot.workModes.defaultModeId
  const defaultIds = new Set(resolveWorkModeDefaultSkillIds(withRoot, workModeId))
  const currentOverride = withRoot.modeSkillOverrides[workModeId] ?? { addedSkillIds: [], removedSkillIds: [] }
  const added = new Set(currentOverride.addedSkillIds)
  const removed = new Set(currentOverride.removedSkillIds)
  removed.delete(skillId)
  if (!defaultIds.has(skillId)) added.add(skillId)
  const skills = {
    ...withRoot,
    modeSkillOverrides: {
      ...withRoot.modeSkillOverrides,
      [workModeId]: {
        addedSkillIds: [...added].sort((a, b) => a.localeCompare(b)),
        removedSkillIds: [...removed].sort((a, b) => a.localeCompare(b))
      }
    }
  }
  const next = QiongqiConfigSchema.parse({
    ...current,
    capabilities: {
      ...(current.capabilities ?? {}),
      skills
    }
  })
  await writeConfig(runtime, next)
  const owner = ownerUserId(actor)
  if (owner && runtime.kworksUserDataStore) {
    await runtime.kworksUserDataStore.setUserSetting(owner, 'capabilities.skills', skills)
    await runtime.kworksUserDataStore.setUserSetting(owner, 'capabilities.skills.compat', skillCompatFromCapability(skills))
  }
  await (runtime.refreshRuntimeTools?.() ?? runtime.refreshMcpTools?.())
  return { ok: true, workModeId }
}

async function readEffectiveConfig(runtime: ServerRuntime, actor?: AuthActor): Promise<QiongqiConfig> {
  const config = await readConfig(runtime)
  const owner = ownerUserId(actor)
  if (!owner || !runtime.kworksUserDataStore) return config
  const savedSkills = await runtime.kworksUserDataStore.getUserSetting(owner, 'capabilities.skills')
  if (!isObject(savedSkills)) return config
  return QiongqiConfigSchema.parse({
    ...config,
    capabilities: {
      ...(config.capabilities ?? {}),
      skills: savedSkills
    }
  })
}

async function readConfig(runtime: ServerRuntime): Promise<QiongqiConfig> {
  if (runtime.configStore) return QiongqiConfigSchema.parse(await runtime.configStore.read())
  const info = runtime.info()
  const model = info.model || 'default'
  return QiongqiConfigSchema.parse({
    serve: {
      host: info.host,
      port: info.port,
      dataDir: info.dataDir,
      runtimeToken: runtime.runtimeToken,
      model,
      approvalPolicy: info.approvalPolicy,
      sandboxMode: info.sandboxMode,
      insecure: info.insecure
    },
    models: {
      profiles: {
        [model]: {
          inputModalities: ['text'],
          outputModalities: ['text'],
          supportsToolCalling: true,
          messageParts: ['text']
        }
      }
    }
  })
}

async function writeConfig(runtime: ServerRuntime, config: QiongqiConfig): Promise<QiongqiConfig> {
  const parsed = QiongqiConfigSchema.parse(config)
  if (!runtime.configStore) return parsed
  return QiongqiConfigSchema.parse(await runtime.configStore.write(parsed))
}

function extractArguments(content: string): string[] {
  const args: string[] = []
  const regex = /add_argument\(\s*['"]([^'"\-][^'"]*)['"]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const name = match[1]?.trim()
    if (name && !args.includes(name)) args.push(name)
  }
  return args
}

function extractDependencies(content: string, kind: string): DependencyEvidence[] {
  if (kind !== 'python') return []
  const builtins = new Set(['argparse', 'os', 'sys', 'json', 're', 'pathlib', 'subprocess', 'typing'])
  const out = new Map<string, DependencyEvidence>()
  for (const line of content.split(/\r?\n/)) {
    const importMatch = /^\s*import\s+([a-zA-Z_][\w.]*)/.exec(line)
    const fromMatch = /^\s*from\s+([a-zA-Z_][\w.]*)\s+import\b/.exec(line)
    const name = (importMatch?.[1] ?? fromMatch?.[1])?.split('.')[0]
    if (name && !builtins.has(name)) out.set(name, { name, source: 'python import' })
  }
  return [...out.values()]
}

function extractRisks(content: string): RiskEvidence[] {
  const risks: RiskEvidence[] = []
  if (/\b(requests|urllib|fetch|curl|wget)\b/.test(content)) {
    risks.push({ severity: 'medium', kind: 'network', evidence: 'network-related import or command detected' })
  }
  if (/rm\s+-rf|shutil\.rmtree|unlink\(|delete\s+/i.test(content)) {
    risks.push({ severity: 'high', kind: 'destructive-filesystem', evidence: 'destructive filesystem operation detected' })
  }
  if (/AKIA[0-9A-Z]{16}|api[_-]?key|secret/i.test(content)) {
    risks.push({ severity: 'medium', kind: 'credentials', evidence: 'credential-like token or variable detected' })
  }
  return risks
}

function invocationFor(path: string, args: string[]): string {
  const script = `scripts/${basename(path)}`
  const suffix = args.map((arg) => `<${arg}>`).join(' ')
  const prefix = extname(path).toLowerCase() === '.py'
    ? `python ${script}`
    : extname(path).toLowerCase() === '.sh'
      ? `bash ${script}`
      : `node ${script}`
  return suffix ? `${prefix} ${suffix}` : prefix
}

function descriptionFromEvidence(evidence: SkillDraftEvidence, title: string): string {
  const snippet = evidence.snippets.map((item) => item.text).join('\n')
  const description = /ArgumentParser\(description=['"]([^'"]+)['"]/.exec(snippet)?.[1]
  return description?.trim() || `Run the bundled ${title} command workflow.`
}

async function loadDraft(runtime: ServerRuntime, draftId: string): Promise<SkillDraftSnapshot | null> {
  if (!isValidDraftId(draftId)) return null
  const content = await readFile(draftMetaPath(runtime, draftId), 'utf8').catch(() => null)
  if (!content) return null
  return JSON.parse(content) as SkillDraftSnapshot
}

async function saveDraft(runtime: ServerRuntime, draft: SkillDraftSnapshot): Promise<void> {
  const root = draftRoot(runtime, draft.draftId)
  await mkdir(root, { recursive: true })
  await writeFile(draftMetaPath(runtime, draft.draftId), `${JSON.stringify(draft, null, 2)}\n`, 'utf8')
}

function draftMetaPath(runtime: ServerRuntime, draftId: string): string {
  return join(draftRoot(runtime, draftId), 'draft.json')
}

function draftFilesRoot(runtime: ServerRuntime, draftId: string): string {
  return join(draftRoot(runtime, draftId), 'files')
}

function draftRoot(runtime: ServerRuntime, draftId: string): string {
  return join(workspaceRootFromRuntimeDataDir(runtime.info().dataDir), 'skill-drafts', draftId)
}

function customSharedSkillRoot(runtime: ServerRuntime): string {
  return join(workspaceRootFromRuntimeDataDir(runtime.info().dataDir), 'skills', 'custom', 'shared')
}

function userSkillInstallRoot(runtime: ServerRuntime, skillId: string): string {
  return join(customSharedSkillRoot(runtime), skillId)
}

function workspaceRootFromRuntimeDataDir(dataDir: string): string {
  const parts = dataDir.split(/[\\/]+/)
  const usersIndex = parts.lastIndexOf('users')
  if (usersIndex < 0) return dataDir
  const leadingSlash = dataDir.startsWith('/') ? '/' : ''
  return `${leadingSlash}${parts.slice(0, usersIndex).join('/')}`
}

function safeUploadPath(name: string): { ok: true; path: string } | { ok: false; detail: string } {
  const normalized = name.replace(/\\/g, '/').split('/').filter(Boolean)
  if (normalized.some((part) => part === '..' || part.startsWith('.'))) {
    return { ok: false, detail: 'uploaded file path contains unsafe segments' }
  }
  const safeParts = normalized.map((part) => basename(part).replace(/[^\w.\- ]+/g, '_').trim()).filter(Boolean)
  const path = safeParts.join('/')
  if (!path) return { ok: false, detail: 'uploaded file name is empty' }
  return { ok: true, path }
}

function kindForPath(path: string): string {
  const extension = extname(path).toLowerCase()
  if (extension === '.py') return 'python'
  if (extension === '.sh') return 'shell'
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs') return 'javascript'
  if (extension === '.ts') return 'typescript'
  if (extension === '.md') return 'markdown'
  if (extension === '.json') return 'json'
  return extension.replace(/^\./, '') || 'text'
}

function draftMode(value: SkillDraftFormValue | null): DraftMode {
  return stringFormValue(value) === 'package' ? 'package' : 'scripts'
}

function parseGeneratedDraft(value: unknown): GeneratedSkillDraft | undefined {
  if (!isObject(value)) return undefined
  const metadata = isObject(value.metadata) ? value.metadata : undefined
  const id = metadata ? stringValue(metadata.id) : undefined
  const name = metadata ? stringValue(metadata.name) : undefined
  const description = metadata ? stringValue(metadata.description) : undefined
  const skillMarkdown = stringValue(value.skillMarkdown)
  if (!id || !name || !description || !skillMarkdown) return undefined
  return {
    metadata: { id, name, description },
    skillMarkdown,
    manifestPatch: isObject(value.manifestPatch) ? value.manifestPatch : {},
    questions: arrayOfObjects(value.questions).map((item) => ({
      field: stringValue(item.field) ?? 'unknown',
      question: stringValue(item.question) ?? ''
    })).filter((item) => item.question),
    warnings: arrayOfObjects(value.warnings).map((item) => ({
      severity: stringValue(item.severity) ?? 'medium',
      message: stringValue(item.message) ?? ''
    })).filter((item) => item.message)
  }
}

function containsUnsafeAbsolutePath(markdown: string): boolean {
  return /(?:^|\s)(?:python3?\s+|bash\s+|node\s+)?(?:\/Users\/|\/home\/|\/private\/|[A-Za-z]:\\)/.test(markdown)
}

function normalizeWorkModeId(id: string | undefined): string | undefined {
  const fromId = id?.trim()
  return fromId ? fromId.toLowerCase() : undefined
}

function isValidCustomSkillId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(id)
}

function isValidDraftId(id: string): boolean {
  return /^draft_[a-f0-9]{16}$/.test(id)
}

function slugifySkillId(value: string | undefined): string | undefined {
  const slug = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || undefined
}

function titleFromSlug(value: string): string {
  return value.split('-').filter(Boolean).map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(' ')
}

function frontmatterLine(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/"/g, '\\"').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function skillCompatFromCapability(value: NonNullable<NonNullable<QiongqiConfig['capabilities']>['skills']>): Record<string, { enabled: boolean }> {
  const out: Record<string, { enabled: boolean }> = {}
  for (const [name, enabled] of Object.entries(value.enabledSkills ?? {})) out[name] = { enabled }
  return out
}

function ownerUserId(actor?: AuthActor): string | undefined {
  return actor && actor.sessionId !== 'runtime-token' ? actor.userId : undefined
}

function stringFormValue(value: SkillDraftFormValue | null): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function arrayOfObjects(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => isObject(item)) : []
}

export async function listSkillDrafts(runtime: ServerRuntime): Promise<JsonResponse> {
  const root = join(workspaceRootFromRuntimeDataDir(runtime.info().dataDir), 'skill-drafts')
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const drafts = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const draft = await loadDraft(runtime, entry.name)
    if (draft) drafts.push({ draftId: draft.draftId, mode: draft.mode, files: draft.files, updatedAt: draft.updatedAt })
  }
  return jsonResponse({ drafts })
}
