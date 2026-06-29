import { afterEach, describe, expect, test, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("@/core/api/fetcher", () => ({
  fetch: fetchMock,
}));

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "",
}));

import { uploadFiles } from "@/core/uploads/api";

describe("uploadFiles", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.clearAllMocks();
  });

  test("surfaces backend error messages and status codes", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "not_found",
          message: "thread not found: draft-thread",
        }),
        {
          status: 404,
          statusText: "Not Found",
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(
      uploadFiles("draft-thread", [
        new File(["hello"], "note.txt", { type: "text/plain" }),
      ]),
    ).rejects.toThrow("Upload failed (404): thread not found: draft-thread");
  });
});
