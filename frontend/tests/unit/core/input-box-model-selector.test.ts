import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  getModelDisplayName,
  getModelSelectorTriggerState,
  resolveSelectedModel,
} from "@/components/workspace/input-box";
import type { Model } from "@/core/models/types";

describe("InputBox model selector trigger", () => {
  test("uses profile names, not provider model ids, as selector values", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../src/components/workspace/input-box.tsx"),
      "utf8",
    );

    expect(source).toContain("value={m.name}");
    expect(source).toContain("onSelect={() => handleModelSelect(m.name)}");
    expect(source).toContain("{m.model}");
  });

  test("keeps a visible trigger while models are loading on a cold new chat", () => {
    expect(
      getModelSelectorTriggerState({
        selectedModel: undefined,
        isLoading: true,
        loadingLabel: "加载中...",
        fallbackLabel: "模型",
      }),
    ).toEqual({
      label: "加载中...",
      disabled: true,
    });
  });

  test("keeps a visible trigger when no models are configured yet", () => {
    expect(
      getModelSelectorTriggerState({
        selectedModel: undefined,
        isLoading: false,
        loadingLabel: "加载中...",
        fallbackLabel: "模型",
      }),
    ).toEqual({
      label: "模型",
      disabled: true,
    });
  });

  test("falls back from display name to model name and provider id", () => {
    expect(
      getModelDisplayName({
        name: "deepseek",
        display_name: "",
        model: "deepseek-chat",
      }),
    ).toBe("deepseek");

    expect(
      getModelDisplayName({
        name: "",
        display_name: "",
        model: "gpt-4.1",
      }),
    ).toBe("gpt-4.1");
  });

  test("prefers the current thread model over the backend active model", () => {
    expect(
      resolveSelectedModel(
        [
          model("selected-for-this-thread", false),
          model("last-added-active-model", true),
        ],
        "selected-for-this-thread",
      ),
    ).toMatchObject({ name: "selected-for-this-thread" });
  });

  test("falls back to the backend active model when the thread model is unavailable", () => {
    expect(
      resolveSelectedModel(
        [
          model("removed-thread-model", false),
          model("last-added-active-model", true),
        ],
        "missing-thread-model",
      ),
    ).toMatchObject({ name: "last-added-active-model" });
  });
});

function model(name: string, active: boolean): Model {
  return {
    id: name,
    name,
    use: "qiongqi",
    model: name,
    display_name: name,
    active,
  };
}
