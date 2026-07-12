---
name: frontend-performance
description: >-
  Use this skill when optimizing web application performance — Core Web Vitals
  (LCP/INP/CLS), bundle size, render blocking, and runtime responsiveness.
  Covers measurement, diagnosis, and targeted optimization.
---

# Frontend Performance Skill

## Purpose

Diagnose and fix frontend performance issues using a measurement-first approach.
Focus on user-perceived performance (Core Web Vitals) rather than micro-benchmarks.

## When To Use

- Page load is slow or LCP/INP/CLS scores are poor
- Bundle size is too large
- UI feels janky or unresponsive during interaction
- Need to establish performance budgets or CI gates

## Core Web Vitals

| Metric | Target | Measures |
|--------|--------|----------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Loading: time to largest visible element |
| **INP** (Interaction to Next Paint) | < 200ms | Responsiveness: delay of all interactions |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability: unexpected layout changes |

**Critical**: lab data (Lighthouse) ≠ field data (CrUX/RUM). Always validate
optimizations against real user data, not just synthetic tests.

## Diagnostic Workflow

### 1. Measure (Don't Guess)
- **Lighthouse** — synthetic lab data; good for CI and quick checks
- **CrUX / RUM** — real user field data; the source of truth for rankings
- **Chrome DevTools Performance** — flamegraph for runtime bottlenecks
- **Bundle analyzer** — webpack-bundle-analyzer / rollup-plugin-visualizer

### 2. Identify the Bottleneck
- **Slow LCP** → large images, render-blocking JS/CSS, slow server response, font loading
- **Poor INP** → long JavaScript tasks, excessive event listeners, synchronous layout
- **High CLS** → images without dimensions, dynamically injected content, web fonts

### 3. Targeted Fixes
- **Images**: `loading="lazy"`, `width`/`height` attributes, modern formats (AVIF/WebP), `srcset`
- **JavaScript**: code-split (React.lazy), defer non-critical, tree-shake, remove unused deps
- **CSS**: inline critical CSS, defer non-critical, purge unused selectors
- **Fonts**: `font-display: swap`, preload primary fonts, `size-adjust` to prevent CLS
- **Third-party**: lazy-load embeds, audit analytics scripts, use facades for video players

### 4. Establish Guardrails
- **Performance budget** — max bundle size, max LCP, etc.
- **Lighthouse CI** — fail the build if scores drop below threshold
- **RUM monitoring** — alert on field data regression

## Guidelines

- **Measure before optimizing** — never guess the bottleneck; always profile first
- **Target the biggest win** — focus on the metric closest to its threshold
- **One change at a time** — measure before and after each optimization
- **Field data is truth** — lab improvements must translate to real user gains
- **Avoid premature optimization** — don't micro-optimize until metrics demand it

## Anti-Pattern: "It Feels Fast On My Machine"

Developer machines are orders of magnitude faster than user devices. Always
test with CPU throttling (4x) and network throttling (Slow 3G) in DevTools.
