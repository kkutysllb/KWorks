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

  test("uploads files through the qiongqi-native attachments endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          attachment: {
            id: "att_123",
            name: "note.txt",
            mimeType: "text/plain",
            byteSize: 5,
            hash: "sha256:test",
            threadIds: ["draft-thread"],
            workspaces: [],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await uploadFiles("draft-thread", [
      new File(["hello"], "note.txt", { type: "text/plain" }),
    ]);

    expect(fetchMock).toHaveBeenCalledWith("/v1/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "note.txt",
        mimeType: "text/plain",
        dataBase64: "aGVsbG8=",
        threadId: "draft-thread",
      }),
    });
    expect(result.files).toEqual([
      {
        filename: "note.txt",
        size: 5,
        path: "att_123",
        virtual_path: "att_123",
        artifact_url: "/v1/attachments/att_123/content",
        extension: "txt",
        modified: Date.parse("2026-01-01T00:00:00.000Z"),
      },
    ]);
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
    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/attachments",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
