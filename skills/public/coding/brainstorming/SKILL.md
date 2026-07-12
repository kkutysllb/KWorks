---
name: brainstorming
description: >-
  Use this skill before any creative coding work — new features, components,
  architecture changes, or behavior modifications. Explores user intent,
  requirements, and design options through collaborative dialogue before
  implementation begins.
---

# Brainstorming Skill

## Purpose

Turn vague coding ideas into fully formed designs and specs through natural
collaborative dialogue — before writing any code.

## When To Use

- User describes a feature, component, or system to build
- A task involves multiple possible approaches with trade-offs
- Requirements are ambiguous or incomplete
- Architecture or design decisions need to be made before implementation

## Workflow

1. **Explore project context** — check relevant files, docs, recent commits, and existing patterns.
2. **Ask clarifying questions** — one at a time. Understand purpose, constraints, success criteria, and non-goals.
3. **Propose 2-3 approaches** — present trade-offs and a recommendation. Let the user choose.
4. **Present design** — in sections scaled to complexity. Get user approval on each section.
5. **Summarize** — produce a concise design summary covering:
   - What is being built and why
   - Chosen approach and key decisions
   - Affected files and components
   - Acceptance criteria
   - Risks and mitigations

## Guidelines

- **One question at a time** — don't overwhelm the user with a long questionnaire.
- **Ground questions in project context** — reference specific files or patterns you found, not abstract theory.
- **Scale the process to complexity** — a one-function utility gets a 3-sentence design; a new subsystem gets a structured doc.
- **Surface assumptions early** — if you're assuming something about the tech stack, conventions, or user intent, state it explicitly and confirm.
- **No code until design is approved** — the output of this skill is a design, not an implementation.

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every task benefits from a brief design pass. "Simple" tasks are where
unexamined assumptions cause the most wasted work. The design can be short
(a few sentences), but you must present it and get approval before
implementing.

## Transition

Once the design is approved, transition to the appropriate implementation
skill (e.g., `implement`, `architecture`, `api-design`) or `planning` for
multi-phase work.
