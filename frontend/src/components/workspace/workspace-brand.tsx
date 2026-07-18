"use client";

import { cn } from "@/lib/utils";

export function WorkspaceBrand({ className }: { className?: string }) {
  const brandClass = cn(
    "min-w-0 truncate bg-linear-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-base font-bold text-transparent",
    className,
  );

  return <div className={brandClass}>KWorks</div>;
}
