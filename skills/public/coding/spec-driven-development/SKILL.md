---
name: spec-driven-development
description: >-
  Use this skill for feature work that needs a spec before implementation —
  requirements analysis, interface design, acceptance criteria, or any task
  where "just start coding" risks wasted effort. Produces a structured spec
  that serves as the single source of truth.
---

# Spec-Driven Development Skill

## Purpose

Bridge the gap between vague feature requests and implementation by producing
a structured specification first. The spec becomes the single source of truth
that guides implementation, testing, and review.

## When To Use

- User requests a new feature, capability, or significant behavior change
- Requirements are ambiguous, incomplete, or contested
- Multiple stakeholders or constraints need alignment
- The change touches shared contracts, public APIs, or data models
- "Just start coding" feels risky because the scope is unclear

## Workflow

### Phase 1: Requirements (What & Why)
1. **Clarify intent** — what problem does this solve? What's the user-visible outcome?
2. **EARS syntax** — express requirements using Easy Approach to Requirements Syntax:
   - `The system SHALL <action> WHEN <condition>`
   - `The system SHALL <action> WHILE <state>`
   - `IF <event>, THEN the system SHALL <response>`
3. **Identify constraints** — performance budgets, backward compatibility, security, regulatory
4. **Define non-goals** — explicitly state what is out of scope

### Phase 2: Design (How)
1. **Interface design** — API contracts, data models, component boundaries
2. **Sequence walkthrough** — trace the happy path and key error paths
3. **Alternatives considered** — document 2-3 approaches and why the chosen one wins
4. **Risk assessment** — what could go wrong? Migration impact? Rollback plan?

### Phase 3: Tasks (Plan)
1. **Decompose** — break the design into independently testable tasks
2. **Order** — dependency-unblocking work first; risky integration early
3. **Acceptance per task** — each task has a concrete, verifiable completion criterion

## Spec Document Structure
```
# Feature: <name>
## Requirements (EARS)
## Design
  ### Interfaces / Data Models
  ### Key Flows
  ### Alternatives Considered
## Task Breakdown
## Acceptance Criteria
## Risks & Mitigations
```

## Guidelines

- **Spec before code** — the output of this skill is a spec document, not an implementation.
- **Scale to complexity** — a one-function feature gets a 5-line spec; a new subsystem gets a full document.
- **Validate with the user** — present the spec and get explicit approval before transitioning to implementation.
- **Specs are living** — update the spec when implementation reveals new constraints; don't let it drift.
- **Link to skills** — after spec approval, transition to `planning` (multi-phase) or `implement` (single-phase).

## Anti-Pattern: "The Requirements Are Obvious"

Requirements are never as obvious as they seem. "Add user authentication" could
mean dozens of different things. The spec pass surfaces hidden assumptions
before they become wasted code.
