---
name: llm-app-development
description: >-
  Use this skill when building LLM-powered applications — agent loops, RAG
  pipelines, prompt-as-code, function calling, and human-in-the-loop gating.
  Covers the full stack from prompt design to evaluation and observability.
---

# LLM Application Development Skill

## Purpose

Guide the construction of applications built on top of large language models —
agents, RAG systems, chatbots, and AI-assisted tools. Covers patterns that are
distinct from traditional software engineering.

## When To Use

- Building an agent, chatbot, or AI assistant
- Implementing RAG (retrieval-augmented generation)
- Designing prompt templates that need versioning and testing
- Integrating function calling / tool use
- Building evaluation pipelines for LLM outputs

## Core Patterns

### 1. Agent Loop
```
Plan → Act (tool call) → Observe (tool result) → Reflect → (loop)
```
- **Plan**: the model decides which tool to call and why
- **Act**: execute the tool call (bash, read, web_search, custom API)
- **Observe**: feed the result back as a tool message
- **Reflect**: the model evaluates progress toward the goal
- **Exit condition**: goal achieved, max iterations, or error threshold

Key design decisions:
- Max iterations (prevent infinite loops)
- Error recovery (retry vs. fall back vs. ask user)
- Context management (summarize between iterations in long loops)

### 2. RAG Pipeline
1. **Query rewriting** — transform the user query for better retrieval
2. **Chunking** — split documents into semantically meaningful chunks (not fixed-size)
3. **Embedding & retrieval** — vector search + optional reranking
4. **Context assembly** — only include retrieved chunks that are relevant (filter aggressively)
5. **Generation** — answer grounded in retrieved context; cite sources
6. **Evaluation** — measure retrieval precision and answer faithfulness

### 3. Prompt-as-Code
- **Version control** — prompts are code, not config; track changes, run regression tests
- **Templating** — use structured templates with clear variable slots, not string concatenation
- **Testing** — maintain a golden test set; run prompts against it on every change
- **Observability** — log prompt, model, params, and output for every production call

### 4. Function Calling / Tool Use
- **Schema-first** — define tool schemas (name, description, parameters) before implementing
- **Description quality** — the model selects tools based on descriptions; write them carefully
- **Error surfaces** — return structured errors the model can understand and recover from
- **Parallel calls** — when independent, batch tool calls to reduce latency

### 5. Human-in-the-Loop
- **Approval gates** — high-stakes actions (file writes, external API calls) require explicit approval
- **Clarification loops** — when confidence is low, ask the user rather than guessing
- **Override paths** — always let the user correct or redirect the agent

## Evaluation

- **Unit tests for prompts** — golden input/output pairs
- **Faithfulness checks** — does the output stay grounded in provided context?
- **Regression suites** — run on every prompt change; track quality drift
- **Production monitoring** — latency, token cost, error rate, user satisfaction

## Guidelines

- **Prompts are liability** — the model can drift between versions; pin model versions in production
- **Streaming first** — design for streaming output from day one; users expect responsive UIs
- **Graceful degradation** — if the LLM call fails, fall back to a reasonable default, don't crash
- **Token economy** — compress tool descriptions, batch independent calls, cache where possible
