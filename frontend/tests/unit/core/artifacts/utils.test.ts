import { describe, expect, test, vi } from "vitest";

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "http://127.0.0.1:19987",
}));

import { resolveArtifactURL, urlOfArtifact } from "@/core/artifacts/utils";

describe("artifact URL helpers", () => {
  test("uses the qiongqi-native artifact content endpoint", () => {
    expect(
      urlOfArtifact({
        filepath: "/mnt/qiongqi/outputs/report.txt",
        threadId: "thread-a",
      }),
    ).toBe(
      "http://127.0.0.1:19987/v1/threads/thread-a/artifacts/content?path=%2Fmnt%2Fqiongqi%2Foutputs%2Freport.txt",
    );
  });

  test("resolves markdown artifact links through the qiongqi-native endpoint", () => {
    expect(resolveArtifactURL("/mnt/qiongqi/uploads/note.md", "thread-a")).toBe(
      "http://127.0.0.1:19987/v1/threads/thread-a/artifacts/content?path=%2Fmnt%2Fqiongqi%2Fuploads%2Fnote.md",
    );
  });
});
