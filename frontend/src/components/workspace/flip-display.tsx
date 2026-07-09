import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

export function FlipDisplay({
  uniqueKey,
  children,
  className,
}: {
  uniqueKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/*
        mode="sync" (default) instead of "popLayout".
        popLayout absolutely-positions exiting elements and re-runs layout on
        every size change — which makes a tool card whose height grows every
        ~100ms during bash output visibly jitter. With a stable uniqueKey
        (bash running = same callId), AnimatePresence renders a single child
        with no enter/exit, so "sync" is a no-op and the card grows cleanly.
        When the key DOES change (a new step becomes active), the swap still
        animates smoothly without the popLayout reflow instability.
      */}
      <AnimatePresence mode="sync">
        <motion.div
          key={uniqueKey}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 2, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
