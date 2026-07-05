"use client";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CodingErrorBoundaryProps = {
  children?: ReactNode;
  className?: string;
  label: string;
  onError?: (error: Error, info: ErrorInfo) => void;
  resetKey?: string | number | null;
};

type CodingErrorBoundaryState = {
  error: Error | null;
};

function describeError(error: Error, info: ErrorInfo, label: string): string {
  const stack = error.stack ? `\n${error.stack}` : "";
  const componentStack = info.componentStack
    ? `\nComponent stack:${info.componentStack}`
    : "";
  return `[kworks] Coding workbench ${label} render failed: ${error.message}${stack}${componentStack}`;
}

export class CodingErrorBoundary extends Component<
  CodingErrorBoundaryProps,
  CodingErrorBoundaryState
> {
  state: CodingErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): CodingErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error(describeError(error, info, this.props.label));
  }

  componentDidUpdate(prevProps: CodingErrorBoundaryProps): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className={cn(
          "bg-background flex h-full min-h-0 w-full items-center justify-center",
          this.props.className,
        )}
        role="alert"
      >
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 text-center">
          <div className="bg-muted/50 text-muted-foreground flex size-10 items-center justify-center rounded-md border">
            <AlertTriangleIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{this.props.label}暂时不可用</p>
            <p className="text-muted-foreground text-xs">
              已记录错误信息，其他工作台区域仍可继续使用。
            </p>
          </div>
          <Button size="sm" type="button" onClick={this.handleRetry}>
            <RefreshCwIcon className="size-4" />
            重试
          </Button>
        </div>
      </div>
    );
  }
}
