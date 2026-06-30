# Skill Import And Script Generation Design

Date: 2026-06-30
Status: Approved direction, pending implementation plan

## Context

The current skill creation page is deterministic but too narrow. It asks the user to fill in fields and renders a `SKILL.md` from those fields. This works for simple prompt-only skills, but it fails when a skill needs bundled assets such as scripts, references, templates, or an already-authored `SKILL.md`.

The visible failure mode is absolute local paths being written into the generated skill instructions, such as:

```bash
python3 /Users/libing/kk_Projects/kk_Stock/kk_QuantFlows/server/skills/md-to-html-converter/scripts/convert.py <input.md> <output.html>
```

That makes the skill machine-specific and breaks the package model. A skill that contains scripts should copy those scripts into the installed skill directory and document relative package paths:

```bash
python scripts/convert.py <input.md> <output.html>
```

## Goals

- Let users create skills from three starting points: blank form, existing skill package, or uploaded scripts.
- Preserve deterministic installation: file copying, path rewriting, manifest writing, and work-mode binding must be handled by application code, not model free-form output.
- Let the model help with interpretation and writing, especially when the user only uploads command scripts.
- Keep generated skills portable by forbidding absolute source paths in installed instructions.
- Surface risks and uncertainty before installation instead of hiding them in generated prose.

## Non-Goals

- Do not execute uploaded scripts during import.
- Do not install dependencies during analysis.
- Do not let the model write directly into the user skill directory.
- Do not infer broad capabilities that are not evidenced by uploaded files.
- Do not redesign the runtime skill activation system.

## User Experience

The skill creation page should become an import-first wizard with three entry cards:

1. **Blank Skill**
   - Keeps the current deterministic form.
   - Best for prompt-only workflows where the user already knows the trigger and output contract.

2. **Import Existing Skill**
   - Accepts `SKILL.md`, `.skill`, a folder, or a zip archive.
   - Detects an existing entry file, manifest, scripts, references, and assets.
   - Shows a preview of files that will be installed.
   - Lets the user bind the skill to a work mode and confirm installation.

3. **Generate From Scripts**
   - Accepts command scripts such as `.py`, `.sh`, `.js`, `.ts`, a folder, or a zip archive.
   - Builds a static evidence package from the uploaded files.
   - Uses the model to draft `SKILL.md` and manifest suggestions from that evidence.
   - Shows required confirmations for uncertain parameters, risky commands, and permissions.

The wizard should end in the same confirmation screen for all paths:

- Skill ID, display name, and description.
- Work mode binding.
- `SKILL.md` preview.
- `skill.json` preview or summary.
- Installed file tree preview.
- Warnings and required confirmations.
- Primary action: **Confirm Install**.

## Script-Only Flow

When the user uploads scripts without a `SKILL.md`, the application should treat it as a generation task.

1. **Upload**
   - Store files in a skill draft workspace rather than a chat thread upload directory.
   - Preserve relative paths from folders or zip archives.
   - Reject path traversal, hidden system files, oversized files, and unsupported binary blobs.

2. **Static Analysis**
   - Identify likely entry scripts.
   - Inspect shebangs, extensions, imports, package files, CLI frameworks, argument parsing, help text, and inline usage examples.
   - Detect dependency hints such as `requirements.txt`, `package.json`, shell commands, and import names.
   - Detect risk hints such as destructive filesystem operations, network downloads, credential access, unrestricted shell execution, writes outside the workspace, and absolute local paths.
   - Produce a structured evidence package.

3. **Model Draft**
   - Send the model only the evidence package and selected text snippets, within a size budget.
   - Ask for a structured draft response, not direct files.
   - Require the model to list uncertainty and warnings explicitly.

4. **Review**
   - Render a side-by-side view: evidence on the left, generated draft on the right.
   - Highlight commands, arguments, dependencies, and risks.
   - Require user confirmation for ambiguous entry scripts, missing required arguments, and high-risk behavior.

5. **Install**
   - Copy uploaded scripts into the skill package, usually under `scripts/`.
   - Write `SKILL.md` from the approved draft.
   - Write `skill.json` from application-controlled data plus approved manifest suggestions.
   - Bind the skill to the selected work mode.
   - Refresh runtime tools.

## Evidence Package

The static analyzer should produce a JSON-compatible object like:

```json
{
  "files": [
    {
      "path": "scripts/convert.py",
      "kind": "python",
      "size": 18342,
      "sha256": "9f86d081884c7d659a2feaa0c55ad015"
    }
  ],
  "entryCandidates": [
    {
      "path": "scripts/convert.py",
      "confidence": 0.86,
      "reason": "has __main__ guard and argparse definitions"
    }
  ],
  "commands": [
    {
      "path": "scripts/convert.py",
      "suggestedInvocation": "python scripts/convert.py <input.md> <output.html>",
      "arguments": [
        { "name": "input", "required": true, "source": "argparse positional" },
        { "name": "output", "required": true, "source": "argparse positional" }
      ]
    }
  ],
  "dependencies": [
    { "name": "markdown", "source": "python import" }
  ],
  "risks": [
    {
      "severity": "medium",
      "kind": "network",
      "evidence": "imports requests"
    }
  ],
  "snippets": [
    {
      "path": "scripts/convert.py",
      "label": "argparse section",
      "text": "parser.add_argument('input'); parser.add_argument('output')"
    }
  ]
}
```

The analyzer owns facts. The model may summarize and organize these facts, but it may not invent facts.

## Model Contract

The model should receive a constrained prompt:

```text
You are generating a KWorks skill draft from uploaded scripts.
Use only facts present in <script_inventory> and <static_analysis>.
Do not claim capabilities that are not evidenced by the uploaded files.
Do not reference local absolute paths.
All commands must use paths relative to the installed skill package, for example `python scripts/foo.py`.
Do not execute scripts, install dependencies, access network resources, or ask the user to run source upload paths.
If required arguments, inputs, outputs, permissions, or entry scripts are uncertain, put them in `questions`.
If risky behavior is detected, put it in `warnings` and do not soften the severity.
Return only JSON matching the schema.
```

The response schema should be similar to:

```json
{
  "metadata": {
    "id": "md-to-html-converter",
    "name": "Markdown To HTML Converter",
    "description": "Convert Markdown files to styled HTML documents."
  },
  "skillMarkdown": "---\nname: md-to-html-converter\ndescription: Convert Markdown files to styled HTML documents.\n---\n\n# Markdown To HTML Converter\n\n## When To Use\nUse when the user needs to convert Markdown files into styled HTML output.",
  "manifestPatch": {
    "category": "workflow",
    "permissions": {
      "workspace": "write",
      "network": false,
      "exec": "workspace",
      "requiresApproval": "on-request"
    },
    "assets": ["scripts/convert.py"]
  },
  "questions": [
    {
      "field": "default_output_path",
      "question": "Should output files default to the source folder or require an explicit path?"
    }
  ],
  "warnings": [
    {
      "severity": "medium",
      "message": "The script imports requests; confirm whether network access is required."
    }
  ]
}
```

The server must validate the JSON shape. Invalid, non-JSON, or path-unsafe output should fail into an editable review state rather than being installed.

## Safety Rules

- Uploaded archive extraction must be sandboxed to a draft directory and reject path traversal.
- Installed files must stay under the target skill root.
- Installed `SKILL.md` must not contain absolute source paths from the upload location or the local home directory.
- Commands in generated instructions must reference copied assets by relative path.
- Permission defaults should be conservative:
  - Prompt-only import: `exec: "none"`.
  - Script-generated skill: `exec: "workspace"` and `requiresApproval: "on-request"`.
  - Network: `false` unless analysis and user confirmation justify it.
- High-risk findings should block one-click install until acknowledged or corrected.
- The model cannot mark a risk as resolved; only user confirmation or deterministic analyzer state can.

## API Shape

Add a draft-oriented skill import API rather than overloading the existing `POST /api/skills/create`.

Suggested endpoints:

- `POST /api/skills/drafts`
  - Creates a draft and uploads files.
  - Accepts multipart form data.
  - Returns draft ID and initial file inventory.

- `POST /api/skills/drafts/:draftId/analyze`
  - Runs deterministic static analysis.
  - Returns the evidence package.

- `POST /api/skills/drafts/:draftId/generate`
  - Runs model drafting from the evidence package.
  - Returns structured draft output.

- `PATCH /api/skills/drafts/:draftId`
  - Saves user edits to metadata, `SKILL.md`, manifest suggestions, selected entry script, and confirmations.

- `POST /api/skills/drafts/:draftId/install`
  - Validates the final draft.
  - Copies files into the user skill root.
  - Writes `SKILL.md` and `skill.json`.
  - Binds the skill to the selected work mode.

The existing `POST /api/skills/create` can remain for the blank form path.

## Frontend Components

The current `SkillCreatePage` should be split into smaller units:

- `SkillCreatePage`
  - Owns route-level state and mode selection.

- `SkillCreateEntryCards`
  - Shows Blank Skill, Import Existing Skill, and Generate From Scripts.

- `SkillDraftUploader`
  - Handles drag-and-drop, folder/zip selection, upload progress, and file inventory.

- `SkillDraftAnalysisPanel`
  - Shows entry candidates, commands, dependencies, and risks.

- `SkillDraftEditor`
  - Shows editable metadata and `SKILL.md` preview.

- `SkillInstallReview`
  - Shows final package tree, permissions, warnings, and confirm action.

The current form can become `BlankSkillForm` and keep using the existing `createSkill` mutation.

## Testing

Backend tests should cover:

- Existing create API still writes deterministic prompt-only skills.
- Draft upload rejects path traversal archives.
- Script analysis detects entry candidates and argument shapes for simple Python and shell scripts.
- Generated drafts with absolute paths are rejected.
- Install copies scripts into `scripts/` and writes relative commands.
- High-risk script findings require confirmation before install.
- Work-mode binding still updates the effective skills config.

Frontend tests should cover:

- The three entry cards render.
- Script upload advances to analysis state.
- Analysis warnings render and block install when required.
- Confirmed install calls the draft install endpoint with work mode ID.
- Blank form path preserves the current request shape.

## Open Decisions

- Whether the first version supports folder upload directly in all browsers, or starts with multi-file and zip upload.
- Whether dependency installation is documented only, or represented in manifest metadata for later runtime support.
- Whether script analyzer lives inside `qiongqi/packages/http-layer/http` initially or becomes a reusable package.
- Whether generated skills should be editable in-place after installation from the same UI.
