/**
 * qiongqi-native streaming hook.
 *
 * Subscribes directly to `GET /v1/threads/:id/events` SSE, consuming raw
 * `RuntimeEvent` and providing the streaming interface consumed by
 * `hooks.ts`'s `useThreadStream`.
 *
 * Architecture:
 *   - `QiongqiThreadMirror` — frontend state machine that accumulates
 *     TurnItems from events and derives `messages[]` / `values`.
 *   - `useQiongqiStream` — React hook managing the SSE lifecycle
 *     (subscribe, reconnect, submit, stop, joinStream).
 *   - SSE is consumed via `fetch` streaming (not EventSource) so the
 *     shared auth/CSRF headers from `api/fetcher` apply transparently.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Todo } from "@/core/todos";

import { fetch } from "../api/fetcher";
import { getBackendBaseURL, isDesktop } from "../config";

import { qiongqiClient, turnItemToMessage } from "./qiongqi-client";
import type { Message, RuntimeEvent, TurnItem } from "./qiongqi-types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface QiongqiStreamOptions<
  StateType extends Record<string, unknown>,
> {
  threadId?: string | null;
  isMock?: boolean;

  /** Fired when a new thread is created inside submit(). */
  onThreadId?: (threadId: string) => void;
  /** Fired after a turn is started. */
  onCreated?: (meta: { thread_id: string; run_id: string }) => void;
  /** Forwarded for every non-item / non-lifecycle RuntimeEvent. */
  onCustomEvent?: (event: unknown) => void;
  /** Fired on tool_call_finished. */
  onToolEnd?: (event: { name: string; data: unknown }) => void;
  /** Fired on stream errors. */
  onError?: (error: unknown) => void;
  /** Fired when a turn completes successfully. */
  onFinish?: (state: StateType) => void;
}

export interface QiongqiStreamResult<
  StateType extends Record<string, unknown>,
> {
  values: StateType;
  messages: Message[];
  isLoading: boolean;
  isThreadLoading: boolean;
  error: unknown;
  stop: () => Promise<void>;
  submit: (
    values: Partial<StateType> | null | undefined,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  joinStream: (
    runId: string,
    lastEventId?: string,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  ensureThread: (
    requestedThreadId: string | undefined,
    context?: Record<string, unknown>,
  ) => Promise<string>;
  clear: () => void;
  /** Returns the id of the currently-running turn, if any. */
  getActiveTurnId: () => string | undefined;
}

// ---------------------------------------------------------------------------
// SSE parsing
// ---------------------------------------------------------------------------

interface ParsedSse {
  id?: string;
  event?: string;
  data: string;
}

/**
 * Parse a single SSE block (separated by `\n\n`) into its fields.
 * Handles `id:`, `event:`, `data:` prefixes per the SSE spec.
 */
function parseSseBlock(raw: string): ParsedSse | null {
  let id: string | undefined;
  let event: string | undefined;
  const dataLines: string[] = [];

  for (const line of raw.split("\n")) {
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
    } else if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
    // Ignore comments (lines starting with ":") and empty lines.
  }

  if (dataLines.length === 0) return null;
  return { id, event, data: dataLines.join("\n") };
}

function normalizeTodos(value: unknown): Todo[] {
  const rawItems = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [];
  return rawItems.filter(isRecord).map((item) => ({
    ...(typeof item.id === "string" ? { id: item.id } : {}),
    ...(typeof item.content === "string" ? { content: item.content } : {}),
    ...(item.status === "pending" ||
    item.status === "in_progress" ||
    item.status === "completed"
      ? { status: item.status }
      : {}),
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// localStorage helpers (persist lastSeq per thread for resumption)
// ---------------------------------------------------------------------------

function getStoredSeq(threadId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(`qiongqi:seq:${threadId}`);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function setStoredSeq(threadId: string, seq: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`qiongqi:seq:${threadId}`, String(seq));
  } catch {
    // ignore quota / privacy mode errors
  }
}

function clearStoredSeq(threadId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`qiongqi:seq:${threadId}`);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// QiongqiThreadMirror — frontend state accumulator.
//
// Maintains an ordered list of TurnItems and derives `Message[]`
// from them. Also tracks per-turn status so the hook can report
// `isLoading` and find the active turn.
// ---------------------------------------------------------------------------

const ITEM_EVENT_KINDS = new Set([
  "item_created",
  "item_updated",
  "item_completed",
  "assistant_text_delta",
  "assistant_reasoning_delta",
  "tool_call_started",
  "tool_call_finished",
]);

const TURN_TERMINAL_KINDS = new Set([
  "turn_completed",
  "turn_failed",
  "turn_aborted",
]);

export class QiongqiThreadMirror {
  private items = new Map<string, TurnItem>();
  private order: string[] = [];
  private turnStatus = new Map<string, string>();
  private displayLengths = new Map<string, number>();
  private title = "";
  private todos: Todo[] = [];
  private lastSeq = 0;

  get currentSeq(): number {
    return this.lastSeq;
  }

  setCurrentSeq(seq: number): void {
    if (seq > this.lastSeq) {
      this.lastSeq = seq;
    }
  }

  setInitialItems(items: TurnItem[]): void {
    this.items.clear();
    this.order = [];
    this.displayLengths.clear();
    for (const item of items) {
      this.items.set(item.id, item);
      this.order.push(item.id);
    }
  }

  setTodos(todos: unknown): void {
    this.todos = normalizeTodos(todos);
  }

  setTurnStatus(turnId: string, status: string): void {
    this.turnStatus.set(turnId, status);
  }

  applyEvent(event: RuntimeEvent): void {
    // Track seq for resumption
    if (typeof event.seq === "number" && event.seq > this.lastSeq) {
      this.lastSeq = event.seq;
    }

    // Assistant delta events carry only the new text chunk while reusing the
    // final item id. Keep a frontend accumulation so the live transcript grows
    // instead of replacing prior chunks until the completed item snapshot lands.
    if (
      (event.kind === "assistant_text_delta" ||
        event.kind === "assistant_reasoning_delta") &&
      "item" in event
    ) {
      const item = (event as { item: TurnItem }).item;
      this.applyAssistantDeltaItem(item);
    } else if (ITEM_EVENT_KINDS.has(event.kind) && "item" in event) {
      const item = (event as { item: TurnItem }).item;
      if (item && item.id) {
        this.setItem(item);
      }
    }
    if (ITEM_EVENT_KINDS.has(event.kind) && "item" in event) {
      const item = (event as { item: TurnItem }).item;
      if (
        item?.turnId &&
        (item.status === "running" || item.status === "pending")
      ) {
        this.turnStatus.set(item.turnId, "running");
      }
    }

    // Turn lifecycle
    if (event.kind === "turn_started" && event.turnId) {
      this.turnStatus.set(event.turnId, "running");
    } else if (TURN_TERMINAL_KINDS.has(event.kind) && event.turnId) {
      this.turnStatus.set(
        event.turnId,
        event.kind === "turn_completed"
          ? "completed"
          : event.kind === "turn_failed"
            ? "failed"
            : "aborted",
      );
    }

    // Thread updates
    if (event.kind === "thread_updated") {
      const e = event as { title?: string };
      if (e.title) this.title = e.title;
    }

    // Todos
    if (event.kind === "todos_updated") {
      const e = event as { todos?: unknown };
      if (e.todos !== undefined) this.todos = normalizeTodos(e.todos);
    } else if (event.kind === "todos_cleared") {
      this.todos = [];
    }
  }

  getMessages(): Message[] {
    return this.order
      .map((id) => this.items.get(id))
      .filter((item): item is TurnItem => item !== undefined)
      .map(turnItemToMessage);
  }

  getDisplayMessages(): Message[] {
    return this.order
      .map((id) => this.items.get(id))
      .filter((item): item is TurnItem => item !== undefined)
      .map((item) => turnItemToMessage(this.itemForDisplay(item)));
  }

  getTitle(): string {
    return this.title;
  }

  getTodos(): Todo[] {
    return this.todos;
  }

  hasActiveTurn(): boolean {
    for (const status of this.turnStatus.values()) {
      if (status === "running" || status === "queued") return true;
    }
    return false;
  }

  hasDisplayBacklog(): boolean {
    return this.pendingDisplayCharacters() > 0;
  }

  pendingDisplayCharacters(): number {
    let pending = 0;
    for (const id of this.order) {
      const item = this.items.get(id);
      if (!item || !isAssistantTextualItem(item)) continue;
      const visible = this.displayLengths.get(id);
      if (visible === undefined) continue;
      pending += Math.max(countTextCharacters(item.text) - visible, 0);
    }
    return pending;
  }

  advanceDisplay(maxCharacters: number): boolean {
    if (maxCharacters <= 0) return false;
    let remaining = maxCharacters;
    let changed = false;
    for (const id of this.order) {
      const item = this.items.get(id);
      if (!item || !isAssistantTextualItem(item)) continue;
      const visible = this.displayLengths.get(id);
      if (visible === undefined) continue;
      const target = countTextCharacters(item.text);
      if (visible >= target) continue;
      const next = Math.min(target, visible + remaining);
      this.displayLengths.set(id, next);
      remaining -= next - visible;
      changed = true;
      if (remaining <= 0) break;
    }
    return changed;
  }

  flushDisplay(): void {
    for (const id of this.order) {
      const item = this.items.get(id);
      if (item && isAssistantTextualItem(item)) {
        this.displayLengths.set(id, countTextCharacters(item.text));
      }
    }
  }

  getActiveTurnId(): string | null {
    // Scan in insertion order, return the last running turn
    let active: string | null = null;
    for (const [turnId, status] of this.turnStatus) {
      if (status === "running" || status === "queued") {
        active = turnId;
      }
    }
    return active;
  }

  reset(): void {
    this.items.clear();
    this.order = [];
    this.turnStatus.clear();
    this.displayLengths.clear();
    this.title = "";
    this.todos = [];
    this.lastSeq = 0;
  }

  private setItem(item: TurnItem): void {
    if (!this.items.has(item.id)) {
      this.order.push(item.id);
    }
    this.items.set(item.id, item);
    if (isAssistantTextualItem(item) && this.displayLengths.has(item.id)) {
      const visible = this.displayLengths.get(item.id) ?? 0;
      this.displayLengths.set(
        item.id,
        Math.min(visible, countTextCharacters(item.text)),
      );
    }
  }

  private applyAssistantDeltaItem(item: TurnItem): void {
    if (
      !item ||
      (item.kind !== "assistant_text" && item.kind !== "assistant_reasoning")
    ) {
      return;
    }
    const existing = this.items.get(item.id);
    if (
      existing &&
      existing.kind === item.kind &&
      typeof existing.text === "string"
    ) {
      if (!this.displayLengths.has(item.id)) {
        this.displayLengths.set(item.id, countTextCharacters(existing.text));
      }
      this.setItem({
        ...item,
        createdAt: existing.createdAt,
        text: existing.text + item.text,
      } as TurnItem);
      return;
    }
    this.displayLengths.set(item.id, 0);
    this.setItem(item);
  }

  private itemForDisplay(item: TurnItem): TurnItem {
    if (!isAssistantTextualItem(item)) return item;
    const visible = this.displayLengths.get(item.id);
    if (visible === undefined) return item;
    return {
      ...item,
      text: sliceTextCharacters(item.text, visible),
    } as TurnItem;
  }
}

function isAssistantTextualItem(
  item: TurnItem,
): item is Extract<
  TurnItem,
  { kind: "assistant_text" | "assistant_reasoning" }
> {
  return item.kind === "assistant_text" || item.kind === "assistant_reasoning";
}

function countTextCharacters(text: string): number {
  return Array.from(text).length;
}

function sliceTextCharacters(text: string, length: number): string {
  return Array.from(text).slice(0, length).join("");
}

function qiongqiModeFromContext(
  context: Record<string, unknown>,
): "agent" | "plan" | undefined {
  if (context.mode === "agent" || context.mode === "plan") {
    return context.mode;
  }
  return context.is_plan_mode === true ? "plan" : undefined;
}

function qiongqiModelFromContext(
  context: Record<string, unknown>,
): string | undefined {
  if (typeof context.model === "string" && context.model.trim()) {
    return context.model.trim();
  }
  if (typeof context.model_name === "string" && context.model_name.trim()) {
    return context.model_name.trim();
  }
  return undefined;
}

function qiongqiReasoningEffortFromContext(
  context: Record<string, unknown>,
): "off" | "low" | "medium" | "high" | "max" | undefined {
  const value = context.reasoning_effort;
  if (value === "minimal" || value === "off") return "off";
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "max"
  ) {
    return value;
  }
  return undefined;
}

function qiongqiApprovalPolicyFromContext(
  context: Record<string, unknown>,
): "on-request" | "untrusted" | "never" | "auto" | "suggest" | undefined {
  const value = context.approvalPolicy;
  if (value === "manual") return "on-request";
  if (
    value === "auto" ||
    value === "never" ||
    value === "on-request" ||
    value === "untrusted" ||
    value === "suggest"
  ) {
    return value;
  }
  return undefined;
}

function attachmentIdsFromAdditionalKwargs(
  additionalKwargs: Record<string, unknown>,
): string[] {
  const files = additionalKwargs.files;
  if (!Array.isArray(files)) return [];
  return files
    .map((file) => {
      if (!file || typeof file !== "object") return null;
      const path = Reflect.get(file, "path");
      return typeof path === "string" && path.trim() ? path.trim() : null;
    })
    .filter((path): path is string => path !== null);
}

function workspaceRootFromContext(
  context: Record<string, unknown>,
): string | undefined {
  const value = context.workspaceRoot;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function workModeIdFromContext(
  context: Record<string, unknown>,
): string | undefined {
  const value = context.workModeId;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// ---------------------------------------------------------------------------
// useQiongqiStream hook
// ---------------------------------------------------------------------------

const RECONNECT_BASE_DELAY = 2000;
const RECONNECT_MAX_DELAY = 30000;
const DISPLAY_TICK_MS = 40;
const DISPLAY_MIN_CHARS_PER_TICK = 2;

type ScheduledSync =
  | { type: "animation-frame"; id: number }
  | { type: "timeout"; id: ReturnType<typeof setTimeout> };

function displayStepForBacklog(pendingCharacters: number): number {
  if (pendingCharacters > 600) return 24;
  if (pendingCharacters > 240) return 12;
  if (pendingCharacters > 80) return 6;
  return DISPLAY_MIN_CHARS_PER_TICK;
}

export function useQiongqiStream<StateType extends Record<string, unknown>>(
  options: QiongqiStreamOptions<StateType>,
): QiongqiStreamResult<StateType> {
  const { threadId, isMock } = options;

  // --- React state ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [values, setValues] = useState<StateType>({} as StateType);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // --- Refs (avoid stale closures in async SSE loop) ---
  const mirrorRef = useRef(new QiongqiThreadMirror());
  const threadIdRef = useRef<string | null>(threadId ?? null);
  const currentTurnIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isSubscribedRef = useRef(false);
  const mountedRef = useRef(true);
  const workModeIdRef = useRef<string | undefined>(undefined);
  const scheduledSyncRef = useRef<ScheduledSync | null>(null);

  // Callback refs
  const onThreadIdRef = useRef(options.onThreadId);
  const onCreatedRef = useRef(options.onCreated);
  const onCustomEventRef = useRef(options.onCustomEvent);
  const onToolEndRef = useRef(options.onToolEnd);
  const onErrorRef = useRef(options.onError);
  const onFinishRef = useRef(options.onFinish);

  // Keep refs in sync with latest props
  useEffect(() => {
    onThreadIdRef.current = options.onThreadId;
    onCreatedRef.current = options.onCreated;
    onCustomEventRef.current = options.onCustomEvent;
    onToolEndRef.current = options.onToolEnd;
    onErrorRef.current = options.onError;
    onFinishRef.current = options.onFinish;
  });

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --- Sync derived state from mirror ---
  const syncState = useCallback(() => {
    if (!mountedRef.current) return;
    const mirror = mirrorRef.current;
    const msgs = mirror.getDisplayMessages();
    setMessages(msgs);
    setValues({
      title: mirror.getTitle(),
      messages: msgs,
      artifacts: [],
      ...(workModeIdRef.current ? { workModeId: workModeIdRef.current } : {}),
      ...(mirror.getTodos().length > 0 ? { todos: mirror.getTodos() } : {}),
    } as unknown as StateType);
    setIsLoading(mirror.hasActiveTurn() || mirror.hasDisplayBacklog());
  }, []);

  const cancelScheduledSync = useCallback(() => {
    const scheduled = scheduledSyncRef.current;
    if (!scheduled) return;
    scheduledSyncRef.current = null;
    if (
      scheduled.type === "animation-frame" &&
      typeof window !== "undefined" &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(scheduled.id);
      return;
    }
    if (scheduled.type === "timeout") {
      clearTimeout(scheduled.id);
    }
  }, []);

  const scheduleSyncState = useCallback(() => {
    if (!mountedRef.current || scheduledSyncRef.current) return;
    const flush = () => {
      scheduledSyncRef.current = null;
      syncState();
    };
    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      scheduledSyncRef.current = {
        type: "animation-frame",
        id: window.requestAnimationFrame(flush),
      };
      return;
    }
    scheduledSyncRef.current = {
      type: "timeout",
      id: setTimeout(flush, 16),
    };
  }, [syncState]);

  // --- Event handler ---
  const handleEvent = useCallback(
    (event: RuntimeEvent) => {
      const mirror = mirrorRef.current;
      mirror.applyEvent(event);

      // Turn lifecycle → isLoading
      if (event.kind === "turn_started") {
        setIsLoading(true);
        if (event.turnId) currentTurnIdRef.current = event.turnId;
      } else if (TURN_TERMINAL_KINDS.has(event.kind)) {
        // Fire onFinish with current state
        const msgs = mirror.getMessages();
        onFinishRef.current?.({
          title: mirror.getTitle(),
          messages: msgs,
          artifacts: [],
          ...(workModeIdRef.current ? { workModeId: workModeIdRef.current } : {}),
        } as unknown as StateType);
      }

      // Persist seq for resumption
      const tid = threadIdRef.current;
      if (tid && event.seq > 0) {
        setStoredSeq(tid, event.seq);
      }

      // Tool end → forward to consumer
      if (event.kind === "tool_call_finished" && "item" in event) {
        const item = (event as { item: TurnItem }).item;
        if (item && item.kind === "tool_result") {
          onToolEndRef.current?.({
            name: (item as { toolName: string }).toolName,
            data: (item as { output: unknown }).output,
          });
        }
      }

      // Error events
      if (event.kind === "error") {
        const e = event as { message?: string; code?: string };
        setError(e);
        onErrorRef.current?.(e);
      }

      // Custom events (everything that's not item/turn/thread lifecycle)
      const isManagedKind =
        ITEM_EVENT_KINDS.has(event.kind) ||
        TURN_TERMINAL_KINDS.has(event.kind) ||
        event.kind === "turn_started" ||
        event.kind === "turn_steered" ||
        event.kind === "thread_created" ||
        event.kind === "thread_updated" ||
        event.kind === "heartbeat";
      if (!isManagedKind) {
        onCustomEventRef.current?.(event);
      }

      scheduleSyncState();
    },
    [scheduleSyncState],
  );

  // --- Smooth display pump ---
  useEffect(() => {
    const timer = setInterval(() => {
      const mirror = mirrorRef.current;
      const pending = mirror.pendingDisplayCharacters();
      if (pending <= 0) {
        if (!mirror.hasActiveTurn()) {
          setIsLoading(false);
        }
        return;
      }
      if (mirror.advanceDisplay(displayStepForBacklog(pending))) {
        syncState();
      }
    }, DISPLAY_TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, [syncState]);

  // --- SSE subscription ---
  const subscribe = useCallback(
    async (tid: string, sinceSeq?: number) => {
      if (isMock || !mountedRef.current) return;
      if (isSubscribedRef.current) return;
      isSubscribedRef.current = true;

      // Cancel any prior connection
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const startSeq = sinceSeq ?? getStoredSeq(tid);

      try {
        const url = `${getBackendBaseURL()}/v1/threads/${encodeURIComponent(tid)}/events`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            ...(startSeq > 0 ? { "Last-Event-ID": String(startSeq) } : {}),
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        // Connection succeeded — reset reconnect backoff
        reconnectAttemptRef.current = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on `\n\n` (event boundary)
          let boundary: number;
          while (
            (boundary = buffer.indexOf("\n\n")) >= 0 &&
            !controller.signal.aborted
          ) {
            const rawBlock = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            const parsed = parseSseBlock(rawBlock);
            if (!parsed) continue;

            try {
              const event = JSON.parse(parsed.data) as RuntimeEvent;
              handleEvent(event);
            } catch {
              // Ignore JSON parse errors (malformed event)
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted || !mountedRef.current) {
          isSubscribedRef.current = false;
          return;
        }

        // Desktop network errors during renderer reload are transient
        const errMsg = err instanceof Error ? err.message : String(err);
        if (
          isDesktop() &&
          (errMsg.includes("network error") ||
            errMsg.includes("Failed to fetch") ||
            errMsg.includes("aborted"))
        ) {
          isSubscribedRef.current = false;
          return;
        }

        onErrorRef.current?.(err);
      }

      isSubscribedRef.current = false;

      // Auto-reconnect with exponential backoff
      if (mountedRef.current && !controller.signal.aborted) {
        const attempt = reconnectAttemptRef.current++;
        const delay = Math.min(
          RECONNECT_BASE_DELAY * 2 ** Math.min(attempt, 4),
          RECONNECT_MAX_DELAY,
        );
        setTimeout(() => {
          if (mountedRef.current && threadIdRef.current === tid) {
            void subscribe(tid);
          }
        }, delay);
      }
    },
    [isMock, handleEvent],
  );

  // --- Initial load: fetch thread record + subscribe ---
  useEffect(() => {
    if (!threadId || isMock) {
      cancelScheduledSync();
      mirrorRef.current.reset();
      workModeIdRef.current = undefined;
      // Clear the stale thread id so ensureThread() doesn't reuse the previous
      // thread when creating/sending on a new-thread page. Without this, a
      // "new task" send silently routes to the old thread.
      threadIdRef.current = null;
      setMessages([]);
      setValues({} as StateType);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    threadIdRef.current = threadId;

    // Reset state for new thread
    cancelScheduledSync();
    mirrorRef.current.reset();
    workModeIdRef.current = undefined;
    setMessages([]);
    setValues({} as StateType);
    setIsLoading(false);
    setError(null);
    currentTurnIdRef.current = null;
    isSubscribedRef.current = false;
    reconnectAttemptRef.current = 0;

    // 1. Fetch thread record for immediate state
    void (async () => {
      try {
        const thread = await qiongqiClient.getThread(threadId);
        if (cancelled) return;
        workModeIdRef.current =
          typeof thread.workModeId === "string" && thread.workModeId.trim()
            ? thread.workModeId.trim()
            : undefined;

        // Build initial state from thread items
        const allItems = thread.turns.flatMap((t) => t.items);
        mirrorRef.current.setInitialItems(allItems);
        mirrorRef.current.setTodos(thread.todos);
        if (typeof thread.latestSeq === "number") {
          mirrorRef.current.setCurrentSeq(thread.latestSeq);
          setStoredSeq(threadId, thread.latestSeq);
        }

        // Set title from thread record
        if (thread.title) {
          const fakeEvent: RuntimeEvent = {
            kind: "thread_updated",
            seq: 0,
            timestamp: thread.updatedAt,
            threadId: thread.id,
            title: thread.title,
          };
          mirrorRef.current.applyEvent(fakeEvent);
        }

        // Check for active turn
        const activeTurn = thread.turns.find(
          (t) => t.status === "running" || t.status === "queued",
        );
        if (activeTurn) {
          currentTurnIdRef.current = activeTurn.id;
          mirrorRef.current.setTurnStatus(activeTurn.id, activeTurn.status);
          setIsLoading(true);
        }

        // Sync derived state
        syncState();

        // 2. Subscribe to SSE for new events
        const startSeq = mirrorRef.current.currentSeq;
        void subscribe(threadId, startSeq);
      } catch {
        // Thread fetch failed — subscribe anyway with stored seq
        if (!cancelled) {
          void subscribe(threadId);
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelScheduledSync();
      abortRef.current?.abort();
      isSubscribedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, isMock]);

  // --- Visibility change: force reconnect on desktop ---
  useEffect(() => {
    if (!isDesktop()) return;

    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        threadIdRef.current &&
        !isSubscribedRef.current
      ) {
        reconnectAttemptRef.current = 0;
        void subscribe(threadIdRef.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [subscribe]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cancelScheduledSync();
      abortRef.current?.abort();
    };
  }, [cancelScheduledSync]);

  const ensureThread = useCallback(
    async (
      requestedThreadId: string | undefined,
      context: Record<string, unknown> = {},
    ): Promise<string> => {
      let activeThreadId = threadIdRef.current;
      const workspaceRoot = workspaceRootFromContext(context);
      const requestedWorkModeId = workModeIdFromContext(context);

      if (!activeThreadId) {
        const modelName = qiongqiModelFromContext(context);
        const newThread = await qiongqiClient.createThread({
          ...(requestedThreadId ? { id: requestedThreadId } : {}),
          ...(workspaceRoot ? { workspace: workspaceRoot } : {}),
          ...(modelName ? { model: modelName } : {}),
          mode: qiongqiModeFromContext(context),
          workModeId: requestedWorkModeId,
        });
        workModeIdRef.current =
          typeof newThread.workModeId === "string" && newThread.workModeId.trim()
            ? newThread.workModeId.trim()
            : requestedWorkModeId;
        activeThreadId = newThread.id;
        threadIdRef.current = activeThreadId;
        onThreadIdRef.current?.(activeThreadId);
        void subscribe(activeThreadId);
        return activeThreadId;
      }

      const currentWorkModeId = workModeIdRef.current;
      const shouldUpdateWorkspace = workspaceRoot !== undefined;
      const shouldUpdateWorkMode =
        requestedWorkModeId !== undefined &&
        requestedWorkModeId !== currentWorkModeId;

      if (shouldUpdateWorkspace || shouldUpdateWorkMode) {
        const previousWorkModeId = workModeIdRef.current;
        const updatedThread = await qiongqiClient.updateThread(activeThreadId, {
          ...(shouldUpdateWorkspace ? { workspace: workspaceRoot } : {}),
          ...(shouldUpdateWorkMode ? { workModeId: requestedWorkModeId } : {}),
        });
        workModeIdRef.current =
          typeof updatedThread.workModeId === "string" &&
          updatedThread.workModeId.trim()
            ? updatedThread.workModeId.trim()
            : (requestedWorkModeId ?? previousWorkModeId);
        syncState();
      }

      return activeThreadId;
    },
    [subscribe, syncState],
  );

  // --- submit ---
  const submit = useCallback(
    async (
      submitValues: Partial<StateType> | null | undefined,
      submitOptions?: Record<string, unknown>,
    ) => {
      // Extract user message text
      const userMessages = submitValues?.messages;
      if (
        !userMessages ||
        !Array.isArray(userMessages) ||
        userMessages.length === 0
      ) {
        return;
      }

      const userMsg = userMessages[0] as
        | (Message & { additional_kwargs?: Record<string, unknown> })
        | undefined;
      if (!userMsg) return;

      // Extract text from content (string or content blocks)
      let text = "";
      if (typeof userMsg.content === "string") {
        text = userMsg.content;
      } else if (Array.isArray(userMsg.content)) {
        for (const part of userMsg.content) {
          if (
            typeof part === "object" &&
            part !== null &&
            part.type === "text"
          ) {
            text += (part as { text: string }).text;
          }
        }
      }

      const additionalKwargs = userMsg.additional_kwargs ?? {};
      const context =
        (submitOptions?.context as Record<string, unknown> | undefined) ?? {};

      // Determine thread ID
      const optionsThreadId = submitOptions?.threadId as string | undefined;
      const requestedThreadId =
        optionsThreadId && optionsThreadId !== "new"
          ? optionsThreadId
          : undefined;
      const activeThreadId = await ensureThread(requestedThreadId, context);
      const turnWorkModeId = workModeIdRef.current;

      const attachmentIds = attachmentIdsFromAdditionalKwargs(additionalKwargs);

      // Handle multitask conflict: if interrupt strategy is requested,
      // abort any in-flight turn before starting a new one.
      if (submitOptions?.multitaskStrategy === "interrupt") {
        const activeTurnId =
          mirrorRef.current.getActiveTurnId() ?? currentTurnIdRef.current;
        if (activeTurnId) {
          try {
            await qiongqiClient.interruptTurn(
              activeThreadId,
              activeTurnId,
              true,
            );
          } catch {
            // Best effort — the backend may have already completed it
          }
        }
      }

      // Start turn
      const modelName = qiongqiModelFromContext(context);
      const result = await qiongqiClient.startTurn(activeThreadId, {
        prompt: text,
        ...(modelName ? { model: modelName } : {}),
        mode: qiongqiModeFromContext(context),
        workModeId: turnWorkModeId,
        reasoningEffort: qiongqiReasoningEffortFromContext(context),
        approvalPolicy: qiongqiApprovalPolicyFromContext(context),
        ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
        ...(additionalKwargs.hide_from_ui === true ? { displayText: "" } : {}),
      });

      currentTurnIdRef.current = result.turnId;
      onCreatedRef.current?.({
        thread_id: activeThreadId,
        run_id: result.turnId,
      });
    },
    [ensureThread],
  );

  // --- stop ---
  const stop = useCallback(async () => {
    const tid = threadIdRef.current;
    const turnId = currentTurnIdRef.current;
    if (tid && turnId) {
      try {
        await qiongqiClient.interruptTurn(tid, turnId, false);
      } catch {
        // Best effort — the SSE stream will confirm termination
      }
    }
  }, []);

  // --- joinStream (reconnect to existing turn) ---
  const joinStream = useCallback(
    async (
      _runId: string,
      _lastEventId?: string,
      _joinOptions?: Record<string, unknown>,
    ) => {
      const tid = threadIdRef.current;
      if (!tid || isMock) return;
      // In qiongqi, SSE is per-thread (not per-run). Re-subscribe
      // with the stored seq to resume the event stream.
      if (!isSubscribedRef.current) {
        reconnectAttemptRef.current = 0;
        void subscribe(tid);
      }
    },
    [isMock, subscribe],
  );

  // --- clear ---
  const clear = useCallback(() => {
    abortRef.current?.abort();
    isSubscribedRef.current = false;
    mirrorRef.current.reset();
    workModeIdRef.current = undefined;
    setMessages([]);
    setValues({} as StateType);
    setIsLoading(false);
    setError(null);
    currentTurnIdRef.current = null;
    const tid = threadIdRef.current;
    if (tid) clearStoredSeq(tid);
  }, []);

  return {
    values,
    messages,
    isLoading,
    isThreadLoading: isLoading,
    error,
    stop,
    submit,
    joinStream,
    ensureThread,
    clear,
    // Returns the id of the currently-running turn, if any. Used by the
    // steering path to target POST /turns/:turnId/steer without aborting.
    getActiveTurnId: () =>
      mirrorRef.current.getActiveTurnId() ?? currentTurnIdRef.current ?? undefined,
  };
}
