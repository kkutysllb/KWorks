---
name: context-engineering
description: >-
  Use this skill to manage context budget for long coding sessions — deciding
  what information to load, what to compress, and how to keep the model focused
  on relevant facts. Covers context window strategy, compaction, and scoped
  retrieval.
---

# Context Engineering Skill

## Purpose

Optimize what information the model sees at each step of a coding task. Context
engineering is about **what to feed** the model — distinct from prompt
engineering (how to phrase it). Good context engineering prevents token waste,
hallucination from stale context, and lost constraints during compaction.

## When To Use

- Working in a large codebase where loading everything exceeds the context budget
- Long multi-turn sessions where early context may be compressed away
- Tasks requiring precise file references without flooding the window
- After compaction, ensuring critical facts survive

## Core Strategies

### 1. Scoped Loading
- **Load only what's relevant** — grep for symbols, read specific functions, not entire files
- **Layered exploration** — directory listing → relevant files → specific functions → line-level detail
- **Tool result hygiene** — summarize large outputs before they enter history; keep facts, drop raw dumps

### 2. Decision Journal
Maintain a running record of key decisions so they survive compaction:
```
Decisions:
- Chose PostgreSQL over MongoDB for transactional integrity (turn 3)
- API path: /api/v2/ to avoid breaking v1 clients (turn 5)
- Excluded weekends from the date range per user constraint (turn 8)
```

### 3. Compaction-Safe Structure
- **Front-load invariants** — constraints, goals, and non-goals should be in the stable prefix
- **Mutable content at the end** — file excerpts, tool results, timestamps stay after the prefix
- **Preserve on compress** — objectives, constraints, decisions, touched files, unresolved tasks

### 4. Retrieval Patterns
- **Just-in-time loading** — don't preload "in case"; load when a step actually needs it
- **Anchor references** — use file:line references instead of pasting code blocks
- **Diff-based context** — for review tasks, load the diff + surrounding context, not the whole file

## Guidelines

- **Budget awareness** — know the model's context window; if you're approaching 60%, start compressing
- **Precision over volume** — 50 lines of exactly the right context beats 500 lines of "maybe relevant"
- **Never lose constraints** — if the user said "don't touch X", that survives every compaction
- **Summarize, don't delete** — when compressing tool results, keep the conclusion ("test passed: 42/42") not the raw output

## Anti-Pattern: "Load Everything Just In Case"

Loading the entire codebase "to be safe" floods the context window, pushes
critical instructions closer to the recency boundary, and increases the chance
of the model confusing old context with current state. Load narrowly, expand
only when needed.
