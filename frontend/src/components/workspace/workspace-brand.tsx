"use client";

import Link from "next/link";

import { env } from "@/env";
import { cn } from "@/lib/utils";

export function WorkspaceBrand({ className }: { className?: string }) {
  const brandClass = cn(
    "min-w-0 truncate bg-linear-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-base font-bold text-transparent",
    className,
  );

  if (env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true") {
    return (
      <Link href="/" className={cn("desktop-no-drag", brandClass)}>
        KWorks
      </Link>
    );
  }

  return <div className={brandClass}>KWorks</div>;
}
