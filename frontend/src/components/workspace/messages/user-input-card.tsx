import { MessageCircleQuestionMarkIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/core/i18n/hooks";
import { qiongqiClient } from "@/core/threads/qiongqi-client";
import type { UserInputTurnItem } from "@/core/threads/qiongqi-types";
import { cn } from "@/lib/utils";

export function UserInputCard({
  userInput,
}: {
  userInput: UserInputTurnItem;
}) {
  const { t } = useI18n();
  const [selectedByQuestion, setSelectedByQuestion] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      userInput.questions.flatMap((question) =>
        question.options[0] ? [[question.id, question.options[0].label]] : [],
      ),
    ),
  );
  const [textByQuestion, setTextByQuestion] = useState<Record<string, string>>(
    {},
  );
  const [detailsByQuestion, setDetailsByQuestion] = useState<
    Record<string, string>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPending = userInput.status === "pending";

  const submitResolution = useCallback(
    async (cancelled = false) => {
      if (!isPending || isSubmitting) return;
      setIsSubmitting(true);
      setError(null);
      try {
        if (cancelled) {
          await qiongqiClient.resolveUserInput(userInput.inputId, {
            cancelled: true,
          });
          return;
        }
        const answers = userInput.questions.map((question) => {
          const selected = selectedByQuestion[question.id] ?? "";
          const freeform = textByQuestion[question.id]?.trim() ?? "";
          const details = detailsByQuestion[question.id]?.trim() ?? "";
          const label = selected || freeform || question.question;
          return {
            id: question.id,
            label,
            value: [selected || freeform, details].filter(Boolean).join("\n\n"),
          };
        });
        await qiongqiClient.resolveUserInput(userInput.inputId, { answers });
      } catch {
        setError(t.userInput.error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      detailsByQuestion,
      isPending,
      isSubmitting,
      selectedByQuestion,
      t.userInput.error,
      textByQuestion,
      userInput.inputId,
      userInput.questions,
    ],
  );

  const statusText =
    userInput.status === "submitted"
      ? t.userInput.submitted
      : userInput.status === "cancelled"
        ? t.userInput.cancelled
        : t.userInput.pending;

  return (
    <section
      className="border-border/70 bg-background/95 flex w-full flex-col gap-4 rounded-lg border p-4 shadow-sm"
      aria-label={t.userInput.title}
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
          <MessageCircleQuestionMarkIcon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-foreground text-sm font-medium">
            {t.userInput.title}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{statusText}</p>
        </div>
      </div>

      {userInput.prompt && (
        <p className="text-foreground text-sm leading-6">{userInput.prompt}</p>
      )}

      <div className="flex flex-col gap-4">
        {userInput.questions.map((question) => {
          const selected = selectedByQuestion[question.id] ?? "";
          const hasOptions = question.options.length > 0;
          return (
            <div key={question.id} className="flex flex-col gap-2">
              <div>
                <div className="text-muted-foreground text-xs font-medium">
                  {question.header}
                </div>
                <div className="text-foreground mt-1 text-sm">
                  {question.question}
                </div>
              </div>
              {hasOptions ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option) => {
                    const isSelected = selected === option.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        disabled={!isPending || isSubmitting}
                        className={cn(
                          "border-border bg-background hover:bg-accent hover:text-accent-foreground min-h-16 rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                          isSelected &&
                            "border-primary bg-primary/10 text-primary hover:bg-primary/10",
                        )}
                        onClick={() =>
                          setSelectedByQuestion((current) => ({
                            ...current,
                            [question.id]: option.label,
                          }))
                        }
                      >
                        <span className="block text-sm font-medium">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="text-muted-foreground mt-1 block text-xs leading-5">
                            {option.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Textarea
                  disabled={!isPending || isSubmitting}
                  value={textByQuestion[question.id] ?? ""}
                  placeholder={t.userInput.answerPlaceholder}
                  onChange={(event) =>
                    setTextByQuestion((current) => ({
                      ...current,
                      [question.id]: event.target.value,
                    }))
                  }
                />
              )}
              {hasOptions && (
                <Textarea
                  disabled={!isPending || isSubmitting}
                  value={detailsByQuestion[question.id] ?? ""}
                  placeholder={t.userInput.detailsPlaceholder}
                  className="min-h-12"
                  onChange={(event) =>
                    setDetailsByQuestion((current) => ({
                      ...current,
                      [question.id]: event.target.value,
                    }))
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {isPending && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={() => void submitResolution(true)}
          >
            {t.userInput.cancel}
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => void submitResolution(false)}
          >
            {isSubmitting ? t.userInput.submitting : t.userInput.submit}
          </Button>
        </div>
      )}
    </section>
  );
}
