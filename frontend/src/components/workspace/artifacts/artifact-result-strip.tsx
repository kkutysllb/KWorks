"use client";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  LoaderIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadArtifactUrl } from "@/core/artifacts/authenticated-url";
import { urlOfArtifact } from "@/core/artifacts/utils";
import { getFileName } from "@/core/utils/files";
import { cn } from "@/lib/utils";

import { useOptionalThread } from "../messages/context";
import { Tooltip } from "../tooltip";

import { useArtifacts } from "./context";

export function ArtifactResultStrip({
  className,
  status,
  threadId,
  onPreview,
}: {
  className?: string;
  status?: string;
  threadId: string;
  /** When provided, preview clicks route here instead of the shared
   *  ArtifactsContext (used by the coding workbench to open its own panel). */
  onPreview?: (filepath: string) => void;
}) {
  const { artifacts, select, setOpen } = useArtifacts();
  const threadContext = useOptionalThread();
  const isMock = threadContext?.isMock ?? false;
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const files = artifacts ?? [];
  const shouldHide =
    files.length === 0 || status === "streaming" || status === "submitted";

  const handlePreview = useCallback(
    (filepath: string) => {
      if (onPreview) {
        onPreview(filepath);
        return;
      }
      select(filepath);
      setOpen(true);
    },
    [onPreview, select, setOpen],
  );

  const handleDownload = useCallback(
    async (filepath: string) => {
      if (downloadingFile) return;

      setDownloadingFile(filepath);
      try {
        await downloadArtifactUrl(
          urlOfArtifact({
            filepath,
            threadId,
            download: true,
            isMock,
          }),
          getFileName(filepath),
        );
      } catch (error) {
        console.error("Failed to download artifact:", error);
        toast.error("结果文件下载失败");
      } finally {
        setDownloadingFile(null);
      }
    },
    [downloadingFile, isMock, threadId],
  );

  if (shouldHide) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-border/70 bg-background/80 flex w-full flex-col gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur",
        !collapsed && "max-h-24 overflow-y-auto",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="text-muted-foreground flex items-center gap-1.5 text-xs transition-colors hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRightIcon className="size-3.5 shrink-0" />
        ) : (
          <ChevronDownIcon className="size-3.5 shrink-0" />
        )}
        <FileTextIcon className="size-3.5 shrink-0 text-emerald-500" />
        <span className="font-medium text-foreground">结果文件</span>
        <span>{files.length} 个</span>
      </button>
      {!collapsed && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((filepath) => {
            const filename = getFileName(filepath);
            const isDownloading = downloadingFile === filepath;
            return (
              <div
                key={filepath}
                className="bg-muted/45 flex max-w-full items-center gap-1 rounded-md border px-1.5 py-1"
              >
                <button
                  className="hover:text-foreground min-w-0 truncate px-1 text-left text-xs transition-colors"
                  title={filename}
                  type="button"
                  onClick={() => handlePreview(filepath)}
                >
                  {filename}
                </button>
                <Tooltip content="预览">
                  <Button
                    aria-label={`预览 ${filename}`}
                    className="size-6"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={() => handlePreview(filepath)}
                  >
                    <EyeIcon className="size-3.5" />
                  </Button>
                </Tooltip>
                <Tooltip content="下载">
                  <Button
                    aria-label={`下载 ${filename}`}
                    className="size-6"
                    disabled={isDownloading}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={() => void handleDownload(filepath)}
                  >
                    {isDownloading ? (
                      <LoaderIcon className="size-3.5 animate-spin" />
                    ) : (
                      <DownloadIcon className="size-3.5" />
                    )}
                  </Button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
