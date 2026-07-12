"use client";

import { ArrowLeftIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadArtifactUrl } from "@/core/artifacts/authenticated-url";
import { useArtifactContent } from "@/core/artifacts/hooks";
import { urlOfArtifact } from "@/core/artifacts/utils";

import { resolveFinanceMarkdownArtifact } from "./finance-artifact-files";

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
  artifacts,
  filepath,
  threadId,
  onBack,
}: FinanceArtifactPreviewProps) {
  const { content, error, isLoading, refetch } = useArtifactContent({
    enabled: true,
    filepath,
    threadId,
  });
  const [htmlUrl, setHtmlUrl] = useState<string>();
  const [isDownloadingMarkdown, setIsDownloadingMarkdown] = useState(false);
  const [isDownloadingHtml, setIsDownloadingHtml] = useState(false);
  const markdownDownloadPending = useRef(false);
  const htmlDownloadPending = useRef(false);
  const filename = basename(filepath);
  const markdownPath = useMemo(
    () => resolveFinanceMarkdownArtifact(filepath, artifacts),
    [artifacts, filepath],
  );

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

  const handleMarkdownDownload = useCallback(async () => {
    if (!markdownPath || markdownDownloadPending.current) return;
    markdownDownloadPending.current = true;
    setIsDownloadingMarkdown(true);
    try {
      await downloadArtifactUrl(
        urlOfArtifact({
          filepath: markdownPath,
          threadId,
          download: true,
        }),
        basename(markdownPath),
      );
    } catch {
      toast.error("Markdown 报告下载失败");
    } finally {
      markdownDownloadPending.current = false;
      setIsDownloadingMarkdown(false);
    }
  }, [markdownPath, threadId]);

  const handleHtmlDownload = useCallback(async () => {
    if (htmlDownloadPending.current) return;
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
  }, [filename, filepath, threadId]);

  const markdownTitle = !markdownPath
    ? "未找到 Markdown 报告"
    : isDownloadingMarkdown
      ? "正在下载 Markdown 报告"
      : `下载 ${basename(markdownPath)}`;

  return createPortal(
    <section
      aria-label="金融结果预览"
      className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-white"
      data-testid="finance-artifact-preview"
    >
      <header className="flex h-11 shrink-0 items-center bg-neutral-950 px-2 text-neutral-100">
        <div className="flex min-w-0 flex-1 basis-0 justify-start">
          <Button
            aria-label="返回任务"
            className="text-neutral-100 hover:bg-neutral-800 hover:text-white"
            onClick={onBack}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ArrowLeftIcon />
            <span className="hidden sm:inline">返回任务</span>
          </Button>
        </div>
        <div className="max-w-[50vw] min-w-0 truncate px-2 text-center text-sm font-medium">
          {filename}
        </div>
        <div className="flex min-w-0 flex-1 basis-0 justify-end">
          <Button
            aria-label="下载 MD 报告"
            className="text-neutral-100 hover:bg-neutral-800 hover:text-white"
            disabled={!markdownPath || isDownloadingMarkdown}
            onClick={() => void handleMarkdownDownload()}
            size="sm"
            title={markdownTitle}
            type="button"
            variant="ghost"
          >
            {isDownloadingMarkdown ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <DownloadIcon />
            )}
            <span className="hidden sm:inline">MD 报告</span>
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center">
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
            </div>
          </div>
        ) : !content ? (
          <div className="flex flex-col items-center gap-3 px-4 text-center">
            <p className="text-sm text-neutral-600">文件内容为空</p>
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
    document.body,
  );
}
