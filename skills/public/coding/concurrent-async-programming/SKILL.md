---
name: concurrent-async-programming
description: >-
  Use this skill for code involving concurrency, parallelism, or async/await —
  race conditions, locks, deadlocks, Promise chains, event loops, and shared
  state synchronization. Covers diagnosis and safe patterns.
---

# Concurrent & Async Programming Skill

## Purpose

Write correct concurrent and asynchronous code by understanding the execution
model, identifying race conditions and deadlocks, and applying proven patterns.

## When To Use

- Code uses async/await, Promises, threads, goroutines, or workers
- Debugging intermittent failures ("works sometimes, fails randomly")
- Shared mutable state is accessed from multiple execution contexts
- Need to reason about ordering, atomicity, or deadlock potential

## Core Concepts

### Event Loop (JavaScript/Node.js)
- **Single-threaded** — one call stack; async I/O via libuv thread pool + OS async
- **Microtask queue** — Promises (.then/.catch/await) run before the next macrotask
- **Macrotask queue** — setTimeout, setInterval, I/O callbacks
- **Blocking the loop** — CPU-heavy synchronous code blocks ALL async work

### Async/Await Pitfalls
- **Sequential when you meant parallel**:
  ```js
  // SLOW — runs one after another
  const a = await fetchA();
  const b = await fetchB();
  // FAST — runs in parallel
  const [a, b] = await Promise.all([fetchA(), fetchB()]);
  ```
- **Unhandled rejections** — `asyncFn()` without `await` or `.catch()` silently drops errors
- **Closure capture in loops** — `for (const i of arr)` is safe; `for (var i ...)` captures by reference

### Race Conditions
- **Check-then-act** — `if (!exists) create()` is racy if two requests run concurrently
- **Solutions**: atomic operations, database constraints (unique index), optimistic locking (version field), pessimistic locking (`SELECT ... FOR UPDATE`)

### Deadlocks
- **Four conditions** — mutual exclusion, hold-and-wait, no preemption, circular wait
- **Prevention**: always acquire locks in a consistent global order; use timeouts
- **Detection**: lock-timeout in DBs; `AbortController` in async code

## Language-Specific Patterns

### JavaScript/TypeScript
- `Promise.all` for parallel independent work; `Promise.allSettled` if partial failure is OK
- `AbortController` for cancellable async operations
- Worker threads (`worker_threads`) for CPU-bound parallelism
- `p-limit` / `p-queue` for concurrency-limited batching

### Python
- `asyncio.gather` for parallel coroutines; `asyncio.TaskGroup` (3.11+) for structured concurrency
- `threading.Lock` / `multiprocessing.Lock` for shared state
- GIL awareness — threading for I/O-bound, multiprocessing for CPU-bound

## Diagnostic Patterns

- **Reproducible tests** — use artificial delays (`setTimeout`, `asyncio.sleep`) to expose races
- **Logging with timestamps** — trace ordering of concurrent operations
- **Stress tests** — run the racy code 1000x to surface intermittent failures
- **Linting** — `eslint-plugin-no-unsanitized`, TypeScript strict mode for `await` discipline

## Guidelines

- **Prefer immutability** — data that can't change can't race
- **Minimize shared state** — pass data via messages (queues, channels) rather than shared variables
- **Make async explicit** — functions that do I/O should be async; callers must await
- **Always handle cancellation** — `AbortController` / `context.Cancel` should propagate cleanly
- **Test under load** — concurrency bugs only appear under contention; test with concurrent workloads

## Anti-Pattern: "It Works On My Machine"

Concurrency bugs are timing-dependent. Code that passes tests locally may fail
under load in production. Always test with concurrent stress workloads and
artificial timing perturbation.
