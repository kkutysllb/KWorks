---
name: skill-manage
description: Register, unregister, validate, repair, enable, disable, and organize KWorks skills. Use this skill whenever the user wants to manage the skill lifecycle, migrate a skill into KWorks, remove a skill from runtime use, fix skill metadata, inspect whether a skill is registered, or sync skill state after editing SKILL.md.
---

# Skill Manage

Use this skill to manage the lifecycle of KWorks skills after they have been created, imported, or edited.

## Responsibilities

- Register a skill directory so KWorks can discover and activate it.
- Unregister a skill while leaving its files on disk when the user wants to disable runtime use.
- Validate `SKILL.md` frontmatter and required files.
- Repair common metadata problems such as missing `name`, weak `description`, or mismatched folder names.
- Enable or disable a registered skill.
- Explain whether a skill is built-in, public, custom, or user-created.

## Workflow

1. Identify the target skill name or directory.
2. Inspect the skill folder and `SKILL.md`.
3. Validate the frontmatter:
   - `name` must be present.
   - `description` must explain when the skill should trigger.
4. For registration, ensure the skill is placed under a managed skills root such as `skills/custom` or the current user's KWorks skills directory.
5. For unregistration, update the skill registry or enablement state without deleting user files unless the user explicitly asks to delete.
6. Report the final lifecycle state: `registered`, `disabled`, `invalid`, or `deleted`.

## Safety

Never delete a user-created skill unless the user explicitly requests deletion. Prefer unregistering or disabling first.
