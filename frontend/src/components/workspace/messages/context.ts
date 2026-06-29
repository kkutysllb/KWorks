import { createContext, useContext } from "react";

import type { AgentThreadState } from "@/core/threads";
import type { BaseStream } from "@/core/threads/qiongqi-types";

export interface ThreadContextType {
  thread: BaseStream<AgentThreadState>;
  isMock?: boolean;
}

export const ThreadContext = createContext<ThreadContextType | undefined>(
  undefined,
);

export function useThread() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThread must be used within a ThreadContext");
  }
  return context;
}

export function useOptionalThread() {
  return useContext(ThreadContext);
}
