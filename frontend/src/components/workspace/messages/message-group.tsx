import {
  ChevronDownIcon,
  FileTextIcon,
  GlobeIcon,
  ListTodoIcon,
  MessageCircleQuestionMarkIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  ChainOfThought,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { CodeBlock } from "@/components/ai-elements/code-block";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { useI18n } from "@/core/i18n/hooks";
import type { Message } from "@/core/threads/qiongqi-types";
import type { ApprovalStore } from "@/core/threads/approval-store";
import {
  describeToolCallDisplay,
  type ToolCallDisplayDetail,
} from "@/core/tools/tool-call-display";
import { isTodoWriteToolName } from "@/core/tools/utils";
import { extractTitleFromMarkdown } from "@/core/utils/markdown";
import { cn } from "@/lib/utils";

import { useArtifacts } from "../artifacts";
import { FlipDisplay } from "../flip-display";
import { BashCommandCard } from "./bash-command-card";
import { convertToSteps } from "./message-steps";
import { ToolStep } from "./tool-step";
import type { ToolCallStatus } from "./tool-step";
import { Tooltip } from "../tooltip";

// Re-export so existing import paths (`@/components/workspace/messages/message-group`)
// continue to resolve, and so Task 9's renderer can consume the step types.
export { convertToSteps } from "./message-steps";
export type { CoTStep, CoTToolCallStep } from "./message-steps";

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
  approvalStore,
  onApprove,
  onDeny,
}: {
  className?: string;
  messages: Message[];
  isLoading?: boolean;
  onOpenFileChange?: MessageFileFocusHandler;
  approvalStore?: ApprovalStore;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
}) {
  const { t } = useI18n();
  const steps = useMemo(
    () => convertToSteps(messages, approvalStore),
    [messages, approvalStore],
  );

  // Split into tool-call steps (rendered as action rows) and reasoning steps
  // (rendered as a collapsible "thinking" block). This enforces a clear visual
  // hierarchy: actions are continuous step rows; thinking is a separate muted
  // block — they no longer interleave with only an icon to distinguish them.
  const toolCallSteps = useMemo(
    () => steps.filter((step) => step.type === "toolCall"),
    [steps],
  );
  const reasoningSteps = useMemo(
    () => steps.filter((step) => step.type === "reasoning"),
    [steps],
  );
  const lastToolCallStep = toolCallSteps[toolCallSteps.length - 1];
  const aboveLastToolCallSteps = lastToolCallStep
    ? toolCallSteps.slice(0, -1)
    : toolCallSteps;
  const reasoningText = useMemo(
    () =>
      reasoningSteps
        .map((step) => step.reasoning ?? "")
        .filter(Boolean)
        .join("\n\n"),
    [reasoningSteps],
  );

  // Tool-call steps are collapsed by default. While a turn is streaming, auto-
  // expand so the user sees live progress; once it settles, respect the user's
  // manual toggle.
  const [userToggled, setUserToggled] = useState(false);
  const [stepsOpenState, setStepsOpenState] = useState(false);
  const stepsOpen = userToggled
    ? stepsOpenState
    : isLoading || stepsOpenState;

  return (
    <ChainOfThought
      className={cn("w-full gap-2 rounded-lg border p-0.5", className)}
    >
      {toolCallSteps.length > 0 && (
        <Collapsible
          open={stepsOpen}
          onOpenChange={(open) => {
            setUserToggled(true);
            setStepsOpenState(open);
          }}
          className="px-4 pb-2"
        >
          <CollapsibleTrigger
            className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 py-2 text-sm transition-colors"
          >
            <span className="font-medium">
              {t.toolCalls.executedSteps(toolCallSteps.length)}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                stepsOpen ? "rotate-180" : "rotate-0",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2">
            {aboveLastToolCallSteps.map((step) => (
              <ToolCall
                key={step.id}
                {...step}
                isLoading={isLoading}
                onOpenFileChange={onOpenFileChange}
                isLast={false}
                onApprove={onApprove}
                onDeny={onDeny}
              />
            ))}
            {lastToolCallStep && (
              <FlipDisplay uniqueKey={lastToolCallStep.id ?? ""}>
                <ToolCall
                  key={lastToolCallStep.id}
                  {...lastToolCallStep}
                  isLast={true}
                  isLoading={isLoading}
                  onOpenFileChange={onOpenFileChange}
                  onApprove={onApprove}
                  onDeny={onDeny}
                />
              </FlipDisplay>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
      {reasoningText && (
        <div className="px-4 pb-2">
          <Reasoning isStreaming={isLoading} defaultOpen={false}>
            <ReasoningTrigger />
            <ReasoningContent>{reasoningText}</ReasoningContent>
          </Reasoning>
        </div>
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
  status = "pending",
  outputText,
  exitCode,
  lineCount,
  approval,
  isLast = false,
  isLoading = false,
  onOpenFileChange,
  onApprove,
  onDeny,
}: {
  id?: string;
  messageId?: string;
  name: string;
  args: Record<string, unknown>;
  result?: string | Record<string, unknown>;
  status?: ToolCallStatus;
  outputText?: string;
  exitCode?: number | null;
  lineCount?: number;
  approval?: {
    approvalId: string;
    status: "pending" | "allowed" | "denied" | "expired";
    summary: string;
  };
  isLast?: boolean;
  isLoading?: boolean;
  onOpenFileChange?: MessageFileFocusHandler;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
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
      <ChainOfThoughtStep key={id} label={label} icon={SearchIcon} isLast={isLast}>
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
      <ChainOfThoughtStep key={id} label={label} icon={SearchIcon} isLast={isLast}>
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
        isLast={isLast}
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
      <ToolStep status={status} label={display.label}>
        <ToolCallDetail detail={display.detail} />
      </ToolStep>
    );
  } else if (name === "read" || name === "read_file") {
    const display = describeToolCallDisplay(name, args, t);
    const path =
      display.detail?.kind === "badge" ? display.detail.value : undefined;
    return (
      <ToolStep
        status={status}
        label={display.label}
        className={path && onOpenFileChange ? "cursor-pointer" : undefined}
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
      </ToolStep>
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
      <ToolStep
        status={status}
        label={display.label}
        className="cursor-pointer"
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
      </ToolStep>
    );
  } else if (name === "bash") {
    const display = describeToolCallDisplay(name, args, t);
    const rawCommand = args.command ?? args.__raw ?? args.input;
    const commandText = typeof rawCommand === "string" ? rawCommand : "";
    return (
      <ToolStep status={status} label={display.label}>
        {commandText ? (
          <BashCommandCard
            command={commandText}
            status={status}
            output={outputText}
            exitCode={exitCode}
            lineCount={lineCount}
            approval={approval}
            t={t}
            onApprove={onApprove}
            onDeny={onDeny}
          />
        ) : null}
      </ToolStep>
    );
  } else if (name === "ask_clarification") {
    return (
      <ChainOfThoughtStep
        key={id}
        label={t.toolCalls.needYourHelp}
        icon={MessageCircleQuestionMarkIcon}
        isLast={isLast}
      ></ChainOfThoughtStep>
    );
  } else if (isTodoWriteToolName(name)) {
    return (
      <ChainOfThoughtStep
        key={id}
        label={t.toolCalls.writeTodos}
        icon={ListTodoIcon}
        isLast={isLast}
      ></ChainOfThoughtStep>
    );
  } else {
    const display = describeToolCallDisplay(name, args, t);
    return (
      <ToolStep status={status} label={display.label}>
        <ToolCallDetail detail={display.detail} />
      </ToolStep>
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
        wrapLines
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
    <ChainOfThoughtSearchResult
      className={cn(
        "max-w-full",
        interactive ? "cursor-pointer" : "",
      )}
    >
      <span
        className="block truncate font-mono text-xs"
        title={detail.value}
      >
        {detail.value}
      </span>
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
