import { expect, test } from "vitest";
import type { Element, Root } from "hast";

import { rehypeSplitWordsIntoSpans } from "@/core/rehype";

function paragraph(value: string): Root {
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        properties: {},
        children: [{ type: "text", value }],
      },
    ],
  };
}

function firstParagraph(tree: Root) {
  return tree.children[0] as Element;
}

test("rehypeSplitWordsIntoSpans wraps short text segments for streaming animation", () => {
  const tree = paragraph("hello world");

  rehypeSplitWordsIntoSpans()(tree);

  expect(firstParagraph(tree).children).toEqual([
    {
      type: "element",
      tagName: "span",
      properties: {
        className: "animate-fade-in",
      },
      children: [{ type: "text", value: "hello" }],
    },
    {
      type: "element",
      tagName: "span",
      properties: {
        className: "animate-fade-in",
      },
      children: [{ type: "text", value: " " }],
    },
    {
      type: "element",
      tagName: "span",
      properties: {
        className: "animate-fade-in",
      },
      children: [{ type: "text", value: "world" }],
    },
  ]);
});

test("rehypeSplitWordsIntoSpans leaves long text unsplit to avoid excessive DOM nodes", () => {
  const value = "word ".repeat(600);
  const tree = paragraph(value);

  rehypeSplitWordsIntoSpans()(tree);

  expect(firstParagraph(tree).children).toEqual([{ type: "text", value }]);
});
