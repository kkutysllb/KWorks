// @vitest-environment happy-dom
import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { I18nProvider } from "@/core/i18n/context";
import { useI18n } from "@/core/i18n/hooks";
import { DEFAULT_LOCALE } from "@/core/i18n/locale";

function LocaleProbe({ onLocale }: { onLocale: (locale: string) => void }) {
  const { locale } = useI18n();

  useEffect(() => {
    onLocale(locale);
  }, [locale, onLocale]);

  return React.createElement("span", null, locale);
}

describe("i18n default locale", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    document.cookie = "locale=; Max-Age=0; path=/";
    Object.defineProperty(window.navigator, "language", {
      value: "en-US",
      configurable: true,
    });
  });

  afterEach(() => {
    root?.unmount();
    container?.remove();
    root = undefined;
    container = undefined;
    vi.restoreAllMocks();
    document.cookie = "locale=; Max-Age=0; path=/";
  });

  test("keeps the product default locale when no user locale cookie exists", async () => {
    const seen: string[] = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale={DEFAULT_LOCALE}>
          <LocaleProbe
            onLocale={(locale) => {
              seen.push(locale);
            }}
          />
        </I18nProvider>,
      );
      await Promise.resolve();
    });

    expect(seen).toEqual(["zh-CN"]);
    expect(document.cookie).not.toContain("locale=en-US");
  });
});
