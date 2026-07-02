import {
  BookOpenTextIcon,
  ChevronUp,
  FileTextIcon,
  FolderOpenIcon,
  GlobeIcon,
  LightbulbIcon,
  ListTodoIcon,
  MessageCircleQuestionMarkIcon,
  NotebookPenIcon,
  SearchIcon,
  SquareTerminalIcon,
  WrenchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/core/i18n/hooks";
import {
  extractReasoningContentFromMessage,
  findToolCallResult,
  stripInternalContent,
} from "@/core/messages/utils";
import { useRehypeSplitWordsIntoSpans } from "@/core/rehype";
import type { Message } from "@/core/threads/qiongqi-types";
import {
  describeToolCallDisplay,
  type ToolCallDisplayDetail,
} from "@/core/tools/tool-call-display";
import { isTodoWriteToolName } from "@/core/tools/utils";
import { extractTitleFromMarkdown } from "@/core/utils/markdown";
import { env } from "@/env";
import { cn } from "@/lib/utils";

import { useArtifacts } from "../artifacts";
import { FlipDisplay } from "../flip-display";
import { Tooltip } from "../tooltip";

import { MarkdownContent } from "./markdown-content";

export type MessageFileFocusTarget = "code" | "task-changes" | "diff";
export type MessageFileFocusHandler = (
  filePath: string,
  target?: MessageFileFocusTarget,
) => void;

export function MessageGroup({
  className,
  messages,
  isLoading = false,
  onOpenFileChange,
}: {
  className?: string;
  messages: Message[];
  isLoading?: boolean;
  onOpenFileChange?: MessageFileFocusHandler;
}) {
  const { t } = useI18n();
  const showReasoningByDefault = env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true";
  const [showAbove, setShowAbove] = useState(showReasoningByDefault);
  const [showLastThinking, setShowLastThinking] = useState(
    showReasoningByDefault,
  );
  const steps = useMemo(() => convertToSteps(messages), [messages]);
  const lastToolCallStep = useMemo(() => {
    const filteredSteps = steps.filter((step) => step.type === "toolCall");
    return filteredSteps[filteredSteps.length - 1];
  }, [steps]);
  const aboveLastToolCallSteps = useMemo(() => {
    if (lastToolCallStep) {
      const index = steps.indexOf(lastToolCallStep);
      return steps.slice(0, index);
    }
    return [];
  }, [lastToolCallStep, steps]);
  const lastReasoningStep = useMemo(() => {
    if (lastToolCallStep) {
      const index = steps.indexOf(lastToolCallStep);
      return steps.slice(index + 1).find((step) => step.type === "reasoning");
    } else {
      const filteredSteps = steps.filter((step) => step.type === "reasoning");
      return filteredSteps[filteredSteps.length - 1];
    }
  }, [lastToolCallStep, steps]);
  const rehypePlugins = useRehypeSplitWordsIntoSpans(isLoading);
  return (
    <ChainOfThought
      className={cn("w-full gap-2 rounded-lg border p-0.5", className)}
      open={true}
    >
      {aboveLastToolCallSteps.length > 0 && (
        <Button
          key="above"
          className="w-full items-start justify-start text-left"
          variant="ghost"
          onClick={() => setShowAbove(!showAbove)}
        >
          <ChainOfThoughtStep
            label={
              <span className="opacity-60">
                {showAbove
                  ? t.toolCalls.lessSteps
                  : t.toolCalls.moreSteps(aboveLastToolCallSteps.length)}
              </span>
            }
            icon={
              <ChevronUp
                className={cn(
                  "size-4 opacity-60 transition-transform duration-200",
                  showAbove ? "rotate-180" : "",
                )}
              />
            }
          ></ChainOfThoughtStep>
        </Button>
      )}
      {lastToolCallStep && (
        <ChainOfThoughtContent className="px-4 pb-2">
          {showAbove &&
            aboveLastToolCallSteps.map((step) =>
              step.type === "reasoning" ? (
                <ChainOfThoughtStep
                  key={step.id}
                  label={
                    <MarkdownContent
                      content={step.reasoning ?? ""}
                      isLoading={isLoading}
                      rehypePlugins={rehypePlugins}
                    />
                  }
                ></ChainOfThoughtStep>
              ) : (
                <ToolCall
                  key={step.id}
                  {...step}
                  isLoading={isLoading}
                  onOpenFileChange={onOpenFileChange}
                />
              ),
            )}
          {lastToolCallStep && (
            <FlipDisplay uniqueKey={lastToolCallStep.id ?? ""}>
              <ToolCall
                key={lastToolCallStep.id}
                {...lastToolCallStep}
                isLast={true}
                isLoading={isLoading}
                onOpenFileChange={onOpenFileChange}
              />
            </FlipDisplay>
          )}
        </ChainOfThoughtContent>
      )}
      {lastReasoningStep && (
        <>
          <Button
            key={lastReasoningStep.id}
            className="w-full items-start justify-start text-left"
            variant="ghost"
            onClick={() => setShowLastThinking(!showLastThinking)}
          >
            <div className="flex w-full items-center justify-between">
              <ChainOfThoughtStep
                className="font-normal"
                label={t.common.thinking}
                icon={LightbulbIcon}
              ></ChainOfThoughtStep>
              <div>
                <ChevronUp
                  className={cn(
                    "text-muted-foreground size-4",
                    showLastThinking ? "" : "rotate-180",
                  )}
                />
              </div>
            </div>
          </Button>
          {showLastThinking && (
            <ChainOfThoughtContent className="px-4 pb-2">
              <ChainOfThoughtStep
                key={lastReasoningStep.id}
                label={
                  <MarkdownContent
                    content={lastReasoningStep.reasoning ?? ""}
                    isLoading={isLoading}
                    rehypePlugins={rehypePlugins}
                  />
                }
              ></ChainOfThoughtStep>
            </ChainOfThoughtContent>
          )}
        </>
      )}
    </ChainOfThought>
  );
}

function ToolCall({
  id,
  messageId,
  name,
  args,
  result,
  isLast = false,
  isLoading = false,
  onOpenFileChange,
}: {
  id?: string;
  messageId?: string;
  name: string;
  args: Record<string, unknown>;
  result?: string | Record<string, unknown>;
  isLast?: boolean;
  isLoading?: boolean;
  onOpenFileChange?: MessageFileFocusHandler;
}) {
  const { t } = useI18n();
  const { setOpen, autoOpen, autoSelect, selectedArtifact, select } =
    useArtifacts();

  if (name === "web_search") {
    let label: React.ReactNode = t.toolCalls.searchForRelatedInfo;
    if (typeof args.query === "string") {
      label = t.toolCalls.searchOnWebFor(args.query);
    }
    return (
      <ChainOfThoughtStep key={id} label={label} icon={SearchIcon}>
        {Array.isArray(result) && (
          <ChainOfThoughtSearchResults>
            {result.map((item) => (
              <ChainOfThoughtSearchResult key={item.url}>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </ChainOfThoughtSearchResult>
            ))}
          </ChainOfThoughtSearchResults>
        )}
      </ChainOfThoughtStep>
    );
  } else if (name === "image_search") {
    let label: React.ReactNode = t.toolCalls.searchForRelatedImages;
    if (typeof args.query === "string") {
      label = t.toolCalls.searchForRelatedImagesFor(args.query);
    }
    const results = (
      result as {
        results: {
          source_url: string;
          thumbnail_url: string;
          image_url: string;
          title: string;
        }[];
      }
    )?.results;
    return (
      <ChainOfThoughtStep key={id} label={label} icon={SearchIcon}>
        {Array.isArray(results) && (
          <ChainOfThoughtSearchResults>
            {Array.isArray(results) &&
              results.map((item) => (
                <Tooltip key={item.image_url} content={item.title}>
                  <a
                    className="size-24 overflow-hidden rounded-lg object-cover"
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="bg-accent size-24">
                      <img
                        className="size-full object-cover"
                        src={item.thumbnail_url}
                        alt={item.title}
                        width={100}
                        height={100}
                      />
                    </div>
                  </a>
                </Tooltip>
              ))}
          </ChainOfThoughtSearchResults>
        )}
      </ChainOfThoughtStep>
    );
  } else if (name === "web_fetch") {
    const url = (args as { url: string })?.url;
    let title = url;
    if (typeof result === "string") {
      const potentialTitle = extractTitleFromMarkdown(result);
      if (potentialTitle && potentialTitle.toLowerCase() !== "untitled") {
        title = potentialTitle;
      }
    }
    return (
      <ChainOfThoughtStep
        key={id}
        label={t.toolCalls.viewWebPage}
        icon={GlobeIcon}
      >
        <ChainOfThoughtSearchResult>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              {title}
            </a>
          )}
        </ChainOfThoughtSearchResult>
      </ChainOfThoughtStep>
    );
  } else if (name === "ls" || name === "grep" || name === "find") {
    const display = describeToolCallDisplay(name, args, t);
    return (
      <ChainOfThoughtStep
        key={id}
        label={display.label}
        icon={name === "ls" ? FolderOpenIcon : SearchIcon}
      >
        <ToolCallDetail detail={display.detail} />
      </ChainOfThoughtStep>
    );
  } else if (name === "read" || name === "read_file") {
    const display = describeToolCallDisplay(name, args, t);
    const path =
      display.detail?.kind === "badge" ? display.detail.value : undefined;
    return (
      <ChainOfThoughtStep
        key={id}
        className={path && onOpenFileChange ? "cursor-pointer" : undefined}
        label={display.label}
        icon={BookOpenTextIcon}
        onClick={() => {
          if (path && onOpenFileChange) {
            onOpenFileChange(path, "code");
          }
        }}
      >
        <ToolCallDetail
          detail={display.detail}
          interactive={Boolean(path && onOpenFileChange)}
          onActivate={
            path && onOpenFileChange
              ? () => onOpenFileChange(path, "code")
              : undefined
          }
        />
      </ChainOfThoughtStep>
    );
  } else if (
    name === "write" ||
    name === "write_file" ||
    name === "edit" ||
    name === "str_replace"
  ) {
    const display = describeToolCallDisplay(name, args, t);
    const path =
      display.detail?.kind === "badge" ? display.detail.value : undefined;
    const fileFocusTarget = fileFocusTargetForTool(name);
    if (
      isLoading &&
      isLast &&
      autoOpen &&
      autoSelect &&
      path &&
      !result &&
      !onOpenFileChange
    ) {
      setTimeout(() => {
        const url = new URL(
          `write-file:${path}?message_id=${messageId}&tool_call_id=${id}`,
        ).toString();
        if (selectedArtifact === url) {
          return;
        }
        select(url, true);
        setOpen(true);
      }, 100);
    }

    return (
      <ChainOfThoughtStep
        key={id}
        className="cursor-pointer"
        label={display.label}
        icon={NotebookPenIcon}
        onClick={() => {
          if (!path) return;
          if (fileFocusTarget && onOpenFileChange) {
            onOpenFileChange(path, fileFocusTarget);
            return;
          }
          select(
            new URL(
              `write-file:${path}?message_id=${messageId}&tool_call_id=${id}`,
            ).toString(),
          );
          setOpen(true);
        }}
      >
        <ToolCallDetail
          detail={display.detail}
          interactive
          onActivate={
            path
              ? () => {
                  if (fileFocusTarget && onOpenFileChange) {
                    onOpenFileChange(path, fileFocusTarget);
                    return;
                  }
                  select(
                    new URL(
                      `write-file:${path}?message_id=${messageId}&tool_call_id=${id}`,
                    ).toString(),
                  );
                  setOpen(true);
                }
              : undefined
          }
        />
      </ChainOfThoughtStep>
    );
  } else if (name === "bash") {
    const display = describeToolCallDisplay(name, args, t);
    return (
      <ChainOfThoughtStep
        key={id}
        label={display.label}
        icon={SquareTerminalIcon}
      >
        <ToolCallDetail detail={display.detail} />
      </ChainOfThoughtStep>
    );
  } else if (name === "ask_clarification") {
    return (
      <ChainOfThoughtStep
        key={id}
        label={t.toolCalls.needYourHelp}
        icon={MessageCircleQuestionMarkIcon}
      ></ChainOfThoughtStep>
    );
  } else if (isTodoWriteToolName(name)) {
    return (
      <ChainOfThoughtStep
        key={id}
        label={t.toolCalls.writeTodos}
        icon={ListTodoIcon}
      ></ChainOfThoughtStep>
    );
  } else {
    const display = describeToolCallDisplay(name, args, t);
    return (
      <ChainOfThoughtStep key={id} label={display.label} icon={WrenchIcon}>
        <ToolCallDetail detail={display.detail} />
      </ChainOfThoughtStep>
    );
  }
}

function ToolCallDetail({
  detail,
  interactive = false,
  onActivate,
}: {
  detail?: ToolCallDisplayDetail;
  interactive?: boolean;
  onActivate?: () => void;
}) {
  if (!detail) return null;
  if (detail.kind === "code") {
    return (
      <CodeBlock
        className="mx-0 cursor-pointer border-none px-0"
        showLineNumbers={false}
        language={detail.language}
        code={detail.value}
      />
    );
  }
  if (interactive && onActivate) {
    return (
      <ChainOfThoughtSearchResult className="bg-muted/70 max-w-full gap-1 px-0 py-0">
        <button
          type="button"
          title={detail.value}
          className="text-primary hover:text-primary/80 inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs underline-offset-2 transition-colors hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            onActivate();
          }}
        >
          <FileTextIcon className="size-3 shrink-0" />
          <span className="truncate">{detail.value}</span>
        </button>
      </ChainOfThoughtSearchResult>
    );
  }
  return (
    <ChainOfThoughtSearchResult className={interactive ? "cursor-pointer" : ""}>
      {detail.value}
    </ChainOfThoughtSearchResult>
  );
}

function fileFocusTargetForTool(name: string): MessageFileFocusTarget | null {
  if (
    name === "write" ||
    name === "write_file" ||
    name === "edit" ||
    name === "str_replace"
  ) {
    return "task-changes";
  }
  if (name === "read" || name === "read_file") {
    return "code";
  }
  return null;
}

interface GenericCoTStep<T extends string = string> {
  id?: string;
  messageId?: string;
  type: T;
}

interface CoTReasoningStep extends GenericCoTStep<"reasoning"> {
  reasoning: string | null;
}

interface CoTToolCallStep extends GenericCoTStep<"toolCall"> {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

type CoTStep = CoTReasoningStep | CoTToolCallStep;

function convertToSteps(messages: Message[]): CoTStep[] {
  const steps: CoTStep[] = [];
  for (const message of messages) {
    if (message.type === "ai") {
      const reasoning = extractReasoningContentFromMessage(message);
      if (reasoning) {
        const step: CoTReasoningStep = {
          id: message.id,
          messageId: message.id,
          type: "reasoning",
          reasoning: stripInternalContent(reasoning),
        };
        steps.push(step);
      }
      for (const tool_call of message.tool_calls ?? []) {
        if (tool_call.name === "task") {
          continue;
        }
        const step: CoTToolCallStep = {
          id: tool_call.id,
          messageId: message.id,
          type: "toolCall",
          name: tool_call.name,
          args: tool_call.args,
        };
        const toolCallId = tool_call.id;
        if (toolCallId) {
          const toolCallResult = findToolCallResult(toolCallId, messages);
          if (toolCallResult) {
            try {
              const json = JSON.parse(toolCallResult);
              step.result = json;
            } catch {
              step.result = toolCallResult;
            }
          }
        }
        steps.push(step);
      }
    }
  }
  return steps;
}
