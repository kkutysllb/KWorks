import "@/styles/globals.css";
import "katex/dist/katex.min.css";

import { type ReactNode } from "react";
import type { Metadata } from "next";

import { DesktopProviders } from "@/components/desktop/providers";

export const metadata: Metadata = {
  title: "KWorks",
  description: "KWorks — AI-powered coding assistant",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <DesktopProviders>{children}</DesktopProviders>
      </body>
    </html>
  );
}
