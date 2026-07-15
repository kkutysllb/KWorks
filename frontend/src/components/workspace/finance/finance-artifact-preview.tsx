"use client";

import { ArrowLeftIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadArtifactUrl } from "@/core/artifacts/authenticated-url";
import { useArtifactContent } from "@/core/artifacts/hooks";
import { urlOfArtifact } from "@/core/artifacts/utils";

import { artifactPathname } from "./finance-artifact-files";

interface FinanceArtifactPreviewProps {
  artifacts: readonly string[];
  filepath: string;
  threadId: string;
  onBack: () => void;
}

function basename(path: string): string {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path;
}

export function FinanceArtifactPreview({
  filepath,
  threadId,
  onBack,
}: FinanceArtifactPreviewProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const isWriteFile = filepath.startsWith("write-file:");
  const artifactPath = artifactPathname(filepath);
  const { content, error, isLoading, refetch } = useArtifactContent({
    enabled: !isWriteFile,
    filepath,
    threadId,
  });
  const [htmlUrl, setHtmlUrl] = useState<string>();
  const [isDownloadingHtml, setIsDownloadingHtml] = useState(false);
  const htmlDownloadPending = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const filename = basename(artifactPath);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!portalTarget || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const siblingStates = Array.from(portalTarget.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== dialog,
      )
      .map((element) => ({
        ariaHidden: element.getAttribute("aria-hidden"),
        element,
        inert: element.inert,
      }));

    for (const state of siblingStates) {
      state.element.inert = true;
      state.element.setAttribute("aria-hidden", "true");
    }
    backButtonRef.current?.focus();

    return () => {
      for (const state of siblingStates) {
        state.element.inert = state.inert;
        if (state.ariaHidden === null) {
          state.element.removeAttribute("aria-hidden");
        } else {
          state.element.setAttribute("aria-hidden", state.ariaHidden);
        }
      }
      previouslyFocused?.focus();
    };
  }, [portalTarget]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  useEffect(() => {
    if (!content) {
      setHtmlUrl(undefined);
      return;
    }

    const nextUrl = URL.createObjectURL(
      new Blob([content], { type: "text/html;charset=utf-8" }),
    );
    setHtmlUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [content]);

  const handleHtmlDownload = useCallback(async () => {
    if (isWriteFile || htmlDownloadPending.current) return;
    htmlDownloadPending.current = true;
    setIsDownloadingHtml(true);
    try {
      await downloadArtifactUrl(
        urlOfArtifact({ filepath, threadId, download: true }),
        filename,
      );
    } catch {
      toast.error("HTML 看板下载失败");
    } finally {
      htmlDownloadPending.current = false;
      setIsDownloadingHtml(false);
    }
  }, [filename, filepath, isWriteFile, threadId]);

  const handleDialogKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'iframe, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [],
  );

  if (!portalTarget) return null;

  return createPortal(
    <section
      aria-label="金融结果预览"
      aria-modal="true"
      className="desktop-no-drag fixed inset-0 z-[100] flex min-h-0 flex-col bg-white"
      data-testid="finance-artifact-preview"
      onKeyDown={handleDialogKeyDown}
      ref={dialogRef}
      role="dialog"
    >
      <header className="desktop-titlebar-drag pointer-events-auto relative z-20 flex h-11 shrink-0 items-center bg-neutral-950 px-2 text-neutral-100">
        <div className="min-w-0 flex-1 basis-0" aria-hidden="true" />
        <div className="max-w-[50vw] min-w-0 truncate px-2 text-center text-sm font-medium">
          {filename}
        </div>
        <div
          className="desktop-no-drag flex min-w-0 flex-1 basis-0 justify-end"
          data-desktop-no-drag="true"
        >
          <Button
            aria-label="返回任务"
            className="desktop-no-drag text-neutral-100 hover:bg-neutral-800 hover:text-white"
            data-desktop-no-drag="true"
            onClick={onBack}
            ref={backButtonRef}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ArrowLeftIcon />
            <span className="hidden sm:inline">返回任务</span>
          </Button>
        </div>
      </header>

      <main className="relative z-0 flex min-h-0 flex-1 items-center justify-center">
        {isLoading ? (
          <p className="text-sm text-neutral-600">正在加载金融看板...</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-4 text-center">
            <div>
              <p className="font-medium text-neutral-900">金融看板加载失败</p>
              <p className="mt-1 text-sm text-neutral-600">{error.message}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                aria-label="重试"
                onClick={() => void refetch()}
                type="button"
                variant="outline"
              >
                重试
              </Button>
              {!isWriteFile ? (
                <Button
                  aria-label="下载 HTML"
                  disabled={isDownloadingHtml}
                  onClick={() => void handleHtmlDownload()}
                  type="button"
                >
                  {isDownloadingHtml ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <DownloadIcon />
                  )}
                  下载 HTML
                </Button>
              ) : null}
            </div>
          </div>
        ) : !content ? (
          <div className="flex flex-col items-center gap-3 px-4 text-center">
            <p className="text-sm text-neutral-600">文件内容为空</p>
            {!isWriteFile ? (
              <Button
                aria-label="下载 HTML"
                disabled={isDownloadingHtml}
                onClick={() => void handleHtmlDownload()}
                type="button"
              >
                {isDownloadingHtml ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <DownloadIcon />
                )}
                下载 HTML
              </Button>
            ) : null}
          </div>
        ) : htmlUrl ? (
          <iframe
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-forms"
            src={htmlUrl}
            title={`${filename} 金融看板`}
          />
        ) : null}
      </main>
    </section>,
    portalTarget,
  );
}
