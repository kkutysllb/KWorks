"use client";

import { useEffect, useRef } from "react";

import { useArtifacts } from "@/components/workspace/artifacts";

import { isHtmlArtifact } from "./finance-artifact-files";
import { FinanceArtifactPreview } from "./finance-artifact-preview";

interface FinanceHtmlArtifactReaderProps {
  threadId: string;
}

export function FinanceHtmlArtifactReader({
  threadId,
}: FinanceHtmlArtifactReaderProps) {
  const { artifacts, deselect, open, selectedArtifact } = useArtifacts();
  const previousThreadIdRef = useRef(threadId);

  useEffect(() => {
    if (previousThreadIdRef.current === threadId) return;
    previousThreadIdRef.current = threadId;
    deselect();
  }, [deselect, threadId]);

  if (!open || !selectedArtifact || !isHtmlArtifact(selectedArtifact)) {
    return null;
  }

  return (
    <FinanceArtifactPreview
      artifacts={artifacts}
      filepath={selectedArtifact}
      onBack={deselect}
      threadId={threadId}
    />
  );
}
