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

  test("uploads files into the thread uploads directory", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          files: [
            {
              filename: "note.txt",
              size: 5,
              path: "/tmp/kworks/threads/draft-thread/uploads/note.txt",
              virtual_path: "/mnt/qiongqi/uploads/note.txt",
              artifact_url:
                "/api/threads/draft-thread/artifacts/mnt/qiongqi/uploads/note.txt",
              extension: "txt",
              modified: 1767225600000,
            },
          ],
          message: "Uploaded 1 file",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await uploadFiles("draft-thread", [
      new File(["hello"], "note.txt", { type: "text/plain" }),
    ]);

    expect(fetchMock).toHaveBeenCalledWith("/api/threads/draft-thread/uploads", {
      method: "POST",
      body: expect.any(FormData),
    });
    expect(result.files).toEqual([
      {
        filename: "note.txt",
        size: 5,
        path: "/tmp/kworks/threads/draft-thread/uploads/note.txt",
        virtual_path: "/mnt/qiongqi/uploads/note.txt",
        artifact_url:
          "/api/threads/draft-thread/artifacts/mnt/qiongqi/uploads/note.txt",
        extension: "txt",
        modified: 1767225600000,
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
      "/api/threads/draft-thread/uploads",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
