"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { isDesktop } from "@/core/config";
import {
  checkForUpdates,
  onUpdateDownloading,
  onUpdateReady,
} from "@/core/desktop/updater";

type UpdateInfo = Awaited<ReturnType<typeof checkForUpdates>>;

type CheckState = "idle" | "checking" | "downloading" | "ready" | "no-update";

/**
 * Desktop auto-update checker.
 *
 * Replaces the old modal-dialog UX with a small icon button anchored to the
 * bottom-left of the window. The button only appears when a new version has
 * been downloaded and is ready to install. Clicking it triggers an immediate
 * restart to apply the update.
 *
 * Lifecycle:
 * 1. On mount (5s delay), silently checks for updates. Downloads happen in
 *    the background (autoDownload=true).
 * 2. When the download completes, a push event sets state to "ready" and the
 *    button appears.
 * 3. Manual "检查更新…" from the app menu still shows transient toast-like
 *    feedback (checking / no-update), but these are also non-blocking.
 */
export function UpdateChecker() {
  const [state, setState] = useState<CheckState>("idle");
  const [update, setUpdate] = useState<UpdateInfo>(null);

  const doCheck = useCallback(async (silent: boolean) => {
    if (!silent) setState("checking");
    const info = await checkForUpdates();
    if (info?.available) {
      setUpdate(info);
      if (!silent) setState("downloading");
    } else if (!silent) {
      setState("no-update");
      // Auto-clear the "up-to-date" feedback after 3s.
      setTimeout(() => setState("idle"), 3000);
    }
  }, []);

  // Automatic silent check 5s after mount (desktop only).
  useEffect(() => {
    if (!isDesktop()) return;
    const timer = setTimeout(() => void doCheck(true), 5000);
    return () => clearTimeout(timer);
  }, [doCheck]);

  // Manual check via app menu "Check for Updates…" (desktop only).
  useEffect(() => {
    if (!isDesktop()) return;
    const bridge = window.kworksDesktop;
    if (!bridge?.onCheckUpdateRequest) return;
    const unsubscribe = bridge.onCheckUpdateRequest(() => void doCheck(false));
    return unsubscribe;
  }, [doCheck]);

  // Push: download started (silent).
  useEffect(() => {
    if (!isDesktop()) return;
    return onUpdateDownloading(() => undefined);
  }, []);

  // Push: download complete → sidebar icon handles the install UI.
  useEffect(() => {
    if (!isDesktop()) return;
    return onUpdateReady(() => {
      setState("ready");
    });
  }, []);

  // ── Transient feedback states (manual check only) ──────────────
  // These show as a small spinner/badge in the bottom-left, auto-dismissing.
  if (state === "checking" || state === "downloading") {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">
          {state === "checking" ? "正在检查更新…" : `正在下载 v${update?.version ?? ""}…`}
        </span>
      </div>
    );
  }

  if (state === "no-update") {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <span className="text-muted-foreground">已是最新版本</span>
      </div>
    );
  }

  // ── Update ready — handled by sidebar icon in WorkspaceUserInfo ──
  // The download icon in the sidebar bottom (workspace-user-info.tsx)
  // listens to the same onUpdateReady event and shows the install button.
  if (state === "ready") {
    return null;
  }

  return null;
}
