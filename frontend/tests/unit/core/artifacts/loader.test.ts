import { beforeEach, describe, expect, test, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/core/api/fetcher", () => ({
  fetch: fetchMock,
}));

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "http://127.0.0.1:19987",
}));

import { loadArtifactContent } from "@/core/artifacts/loader";

describe("artifact content loader", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("returns artifact text from the native content endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("# Report", {
        status: 200,
        headers: { "Content-Type": "text/markdown" },
      }),
    );

    await expect(
      loadArtifactContent({
        filepath: "/Users/libing/project/report.md",
        threadId: "thr_1",
      }),
    ).resolves.toMatchObject({
      content: "# Report",
      url: "http://127.0.0.1:19987/v1/threads/thr_1/artifacts/content?path=%2FUsers%2Flibing%2Fproject%2Freport.md",
    });
  });

  test("throws when the artifact endpoint rejects the file instead of rendering an empty preview", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        statusText: "Forbidden",
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      loadArtifactContent({
        filepath: "/Users/libing/project/report.md",
        threadId: "thr_1",
      }),
    ).rejects.toThrow("Failed to load artifact /Users/libing/project/report.md (403 Forbidden)");
  });
});
