import {
  Code2Icon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  LoaderIcon,
  PackageIcon,
  SquareArrowOutUpRightIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";
import {
  SelectContent,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CodeEditor } from "@/components/workspace/code-editor";
import {
  downloadArtifactUrl,
  openArtifactUrl,
  useAuthenticatedArtifactObjectUrl,
} from "@/core/artifacts/authenticated-url";
import { useArtifactContent } from "@/core/artifacts/hooks";
import { urlOfArtifact } from "@/core/artifacts/utils";
import { useI18n } from "@/core/i18n/hooks";
import { installSkill } from "@/core/skills/api";
import { streamdownPlugins } from "@/core/streamdown";
import { checkCodeFile, getFileName } from "@/core/utils/files";
import { env } from "@/env";
import { cn } from "@/lib/utils";

import { ArtifactLink } from "../citations/artifact-link";
import { useOptionalThread } from "../messages/context";
import { Tooltip } from "../tooltip";

import { useArtifacts } from "./context";

export function ArtifactFileDetail({
  className,
  filepath: filepathFromProps,
  threadId,
  isMock: isMockFromProps = false,
}: {
  className?: string;
  filepath: string;
  threadId: string;
  isMock?: boolean;
}) {
  const { t } = useI18n();
  const { artifacts, setOpen, select } = useArtifacts();
  const threadContext = useOptionalThread();
  const isMock = threadContext?.isMock ?? isMockFromProps;
  const isWriteFile = useMemo(() => {
    return filepathFromProps.startsWith("write-file:");
  }, [filepathFromProps]);
  const filepath = useMemo(() => {
    if (isWriteFile) {
      const url = new URL(filepathFromProps);
      return decodeURIComponent(url.pathname);
    }
    return filepathFromProps;
  }, [filepathFromProps, isWriteFile]);
  const isSkillFile = useMemo(() => {
    return filepath.endsWith(".skill");
  }, [filepath]);
  const { isCodeFile, language } = useMemo(() => {
    if (isWriteFile) {
      let language = checkCodeFile(filepath).language;
      language ??= "text";
      return { isCodeFile: true, language };
    }
    // Treat .skill files as markdown (they contain SKILL.md)
    if (isSkillFile) {
      return { isCodeFile: true, language: "markdown" };
    }
    return checkCodeFile(filepath);
  }, [filepath, isWriteFile, isSkillFile]);
  const isSupportPreview = useMemo(() => {
    return language === "html" || language === "markdown";
  }, [language]);
  const {
    content,
    isLoading: isContentLoading,
    error: contentError,
  } = useArtifactContent({
    threadId,
    filepath: filepathFromProps,
    enabled: isCodeFile && !isWriteFile,
  });
  const artifactUrl = useMemo(
    () => (!isWriteFile ? urlOfArtifact({ filepath, threadId, isMock }) : null),
    [filepath, isMock, isWriteFile, threadId],
  );
  const authenticatedArtifactUrl =
    useAuthenticatedArtifactObjectUrl(artifactUrl);

  const displayContent = content ?? "";
  const isFetchedCodeArtifact = isCodeFile && !isWriteFile;
  const contentState =
    isFetchedCodeArtifact && isContentLoading
      ? "loading"
      : isFetchedCodeArtifact && contentError
        ? "error"
        : isFetchedCodeArtifact && displayContent.length === 0
          ? "empty"
          : "ready";

  const [viewMode, setViewMode] = useState<"code" | "preview">("code");
  const [isInstalling, setIsInstalling] = useState(false);
  useEffect(() => {
    if (isSupportPreview) {
      setViewMode("preview");
    } else {
      setViewMode("code");
    }
  }, [isSupportPreview]);

  const handleInstallSkill = useCallback(async () => {
    if (isInstalling) return;

    setIsInstalling(true);
    try {
      const result = await installSkill({
        thread_id: threadId,
        path: filepath,
        workModeId: threadContext?.thread.values.workModeId,
      });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Failed to install skill");
      }
    } catch (error) {
      console.error("Failed to install skill:", error);
      toast.error("Failed to install skill");
    } finally {
      setIsInstalling(false);
    }
  }, [
    threadContext?.thread.values.workModeId,
    threadId,
    filepath,
    isInstalling,
  ]);
  return (
    <Artifact className={cn(className)}>
      <ArtifactHeader className="px-2">
        <div className="flex items-center gap-2">
          <ArtifactTitle>
            {isWriteFile ? (
              <div className="px-2">{getFileName(filepath)}</div>
            ) : (
              <Select value={filepath} onValueChange={select}>
                <SelectTrigger className="border-none bg-transparent! shadow-none select-none focus:outline-0 active:outline-0">
                  <SelectValue placeholder="Select a file" />
                </SelectTrigger>
                <SelectContent className="select-none">
                  <SelectGroup>
                    {(artifacts ?? []).map((filepath) => (
                      <SelectItem key={filepath} value={filepath}>
                        {getFileName(filepath)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </ArtifactTitle>
        </div>
        <div className="flex min-w-0 grow items-center justify-center">
          {isSupportPreview && (
            <ToggleGroup
              className="mx-auto"
              type="single"
              variant="outline"
              size="sm"
              value={viewMode}
              onValueChange={(value) => {
                if (value) {
                  setViewMode(value as "code" | "preview");
                }
              }}
            >
              <ToggleGroupItem value="code">
                <Code2Icon />
              </ToggleGroupItem>
              <ToggleGroupItem value="preview">
                <EyeIcon />
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ArtifactActions>
            {!isWriteFile && filepath.endsWith(".skill") && (
              <Tooltip content={t.toolCalls.skillInstallTooltip}>
                <ArtifactAction
                  icon={isInstalling ? LoaderIcon : PackageIcon}
                  label={t.common.install}
                  tooltip={t.common.install}
                  disabled={
                    isInstalling ||
                    env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true"
                  }
                  onClick={handleInstallSkill}
                />
              </Tooltip>
            )}
            {!isWriteFile && (
              <ArtifactAction
                icon={SquareArrowOutUpRightIcon}
                label={t.common.openInNewWindow}
                tooltip={t.common.openInNewWindow}
                onClick={() => {
                  void openArtifactUrl(
                    urlOfArtifact({ filepath, threadId, isMock }),
                    getFileName(filepath),
                  );
                }}
              />
            )}
            {isCodeFile && (
              <ArtifactAction
                icon={CopyIcon}
                label={t.clipboard.copyToClipboard}
                disabled={!content}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(displayContent ?? "");
                    toast.success(t.clipboard.copiedToClipboard);
                  } catch (error) {
                    toast.error("Failed to copy to clipboard");
                    console.error(error);
                  }
                }}
                tooltip={t.clipboard.copyToClipboard}
              />
            )}
            {!isWriteFile && (
              <ArtifactAction
                icon={DownloadIcon}
                label={t.common.download}
                className="text-foreground"
                tooltip={t.common.download}
                onClick={() => {
                  void downloadArtifactUrl(
                    urlOfArtifact({
                      filepath,
                      threadId,
                      download: true,
                      isMock,
                    }),
                    getFileName(filepath),
                  );
                }}
              />
            )}
            <ArtifactAction
              icon={XIcon}
              label={t.common.close}
              onClick={() => setOpen(false)}
              tooltip={t.common.close}
            />
          </ArtifactActions>
        </div>
      </ArtifactHeader>
      <ArtifactContent className="p-0">
        {contentState !== "ready" ? (
          <ArtifactContentState
            state={contentState}
            error={contentError}
            filename={getFileName(filepath)}
            onDownload={
              !isWriteFile
                ? () =>
                    void downloadArtifactUrl(
                      urlOfArtifact({
                        filepath,
                        threadId,
                        download: true,
                        isMock,
                      }),
                      getFileName(filepath),
                    )
                : undefined
            }
            onOpen={
              artifactUrl
                ? () => void openArtifactUrl(artifactUrl, getFileName(filepath))
                : undefined
            }
          />
        ) : (
          <>
            {isSupportPreview &&
              viewMode === "preview" &&
              (language === "markdown" || language === "html") && (
                <ArtifactFilePreview
                  content={displayContent}
                  language={language ?? "text"}
                />
              )}
            {isCodeFile && viewMode === "code" && (
              <CodeEditor
                className="size-full resize-none rounded-none border-none"
                value={displayContent ?? ""}
                readonly
              />
            )}
            {!isCodeFile && (
              <iframe className="size-full" src={authenticatedArtifactUrl} />
            )}
          </>
        )}
      </ArtifactContent>
    </Artifact>
  );
}

function ArtifactContentState({
  error,
  filename,
  onDownload,
  onOpen,
  state,
}: {
  error?: Error | null;
  filename: string;
  onDownload?: () => void;
  onOpen?: () => void;
  state: "loading" | "error" | "empty";
}) {
  const message =
    state === "loading"
      ? "正在加载结果文件..."
      : state === "empty"
        ? "文件内容为空"
        : "文件内容加载失败";
  const detail =
    state === "error"
      ? (error?.message ?? "请确认文件仍在当前任务工作区内。")
      : filename;
  const hasAction = Boolean(onOpen ?? onDownload);

  return (
    <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="bg-muted/60 flex h-12 w-12 items-center justify-center rounded-lg">
        {state === "loading" ? (
          <LoaderIcon className="h-5 w-5 animate-spin" />
        ) : (
          <Code2Icon className="h-5 w-5" />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">{message}</p>
        <p className="max-w-md text-xs [overflow-wrap:anywhere]">{detail}</p>
      </div>
      {state === "error" && hasAction && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onOpen && (
            <Button size="sm" variant="outline" onClick={onOpen}>
              <SquareArrowOutUpRightIcon className="size-4" />
              打开
            </Button>
          )}
          {onDownload && (
            <Button size="sm" variant="outline" onClick={onDownload}>
              <DownloadIcon className="size-4" />
              下载
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ArtifactFilePreview({
  content,
  language,
}: {
  content: string;
  language: string;
}) {
  const [htmlPreviewUrl, setHtmlPreviewUrl] = useState<string>();

  useEffect(() => {
    if (language !== "html") {
      setHtmlPreviewUrl(undefined);
      return;
    }

    const blob = new Blob([content ?? ""], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setHtmlPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [content, language]);

  if (language === "markdown") {
    return (
      <div className="size-full px-4">
        <Streamdown
          className="size-full"
          {...streamdownPlugins}
          components={{ a: ArtifactLink }}
        >
          {content ?? ""}
        </Streamdown>
      </div>
    );
  }
  if (language === "html") {
    return (
      <iframe
        className="size-full"
        title="Artifact preview"
        sandbox="allow-scripts allow-forms"
        src={htmlPreviewUrl}
      />
    );
  }
  return null;
}
