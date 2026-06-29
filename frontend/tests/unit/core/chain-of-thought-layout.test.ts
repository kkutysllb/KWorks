import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";

test("ChainOfThoughtStep keeps streamed reasoning content visible while expanded", () => {
  const html = renderToStaticMarkup(
    createElement(
      ChainOfThought,
      { open: true },
      createElement(
        ChainOfThoughtContent,
        null,
        createElement(ChainOfThoughtStep, {
          label: createElement("p", null, "first line\nsecond line\nthird line"),
        }),
      ),
    ),
  );

  expect(html).toContain("overflow-visible");
  expect(html).not.toContain("space-y-2 overflow-hidden");
});
