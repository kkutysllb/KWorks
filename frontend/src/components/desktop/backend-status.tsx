"use client";

import { useCallback, useEffect, useState } from "react";

import { isDesktopBackendManagedMode } from "@/core/config";
import {
  getBackendStatus,
  restartBackend,
  type BackendStatus,
} from "@/core/desktop";

/**
 * Backend status indicator for the desktop app.
 *
 * Shows a small pill indicating whether the embedded Node gateway is running,
 * starting, stopped, or errored. Only rendered when running inside Electron.
 */
export function BackendStatusIndicator() {
  const [status, setStatus] = useState<BackendStatus | null>(null);

  const refresh = useCallback(async () => {
    if (!isDesktopBackendManagedMode()) return;
    const s = await getBackendStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    if (!isDesktopBackendManagedMode()) return;

    // Poll status every 3 seconds
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleRestart = async () => {
    await restartBackend();
    setTimeout(() => void refresh(), 1000);
  };

  // Don't render anything outside Electron
  if (!isDesktopBackendManagedMode()) return null;

  const statusColor =
    status?.status === "running"
      ? "bg-green-500"
      : status?.status === "starting"
        ? "bg-yellow-500 animate-pulse"
        : status?.status === "error"
          ? "bg-red-500"
          : "bg-gray-500";

  const statusText =
    status?.status === "running"
      ? "Running"
      : status?.status === "starting"
        ? "Starting..."
        : status?.status === "error"
          ? `Error${status.error ? `: ${status.error.slice(0, 40)}` : ""}`
          : "Stopped";

  return (
    <div className="flex items-center">
      {/* Status bar — compact pill */}
      <div className="flex h-7 items-center gap-2 rounded-md border bg-background/80 px-2.5 text-xs shadow-sm backdrop-blur-sm">
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`} />
        <span className="whitespace-nowrap text-muted-foreground">
          {statusText}
          {status?.port ? ` :${status.port}` : ""}
        </span>
        {status?.status === "error" && (
          <button
            onClick={handleRestart}
            className="ml-0.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-red-700"
          >
            Restart
          </button>
        )}
      </div>
    </div>
  );
}
