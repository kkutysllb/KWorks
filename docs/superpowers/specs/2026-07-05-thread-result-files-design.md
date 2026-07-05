# Thread Result Files Download Design

## Problem

Qiongqi can expose task result files through the thread artifact API, but the
frontend currently has no reliable download entry after a task finishes. The
existing UI already contains an artifact trigger, a right-side result files
panel, file cards, and download actions, but Qiongqi thread adapters populate
`thread.values.artifacts` with an empty array. As a result, the trigger stays
hidden and generated result files are not discoverable.

## Backend Contract

Use the current Qiongqi-native artifact endpoints:

- `GET /v1/threads/:id/artifacts`
  - Returns `{ threadId, artifacts }`.
  - Each artifact includes `name`, `byteSize`, `virtualPath`, and `updatedAt`.
  - `virtualPath` is the frontend file identifier, for example
    `/mnt/qiongqi/outputs/report.txt`.
- `GET /v1/threads/:id/artifacts/content?path=<virtualPath>`
  - Returns the artifact bytes with an appropriate content type.
  - Existing frontend helpers already generate this URL and handle protected
    desktop downloads.

Do not use `/api/projects/:id/file` for this feature. That endpoint is for
project workspace file browsing and returns UTF-8 JSON content, not the thread
result artifact download contract.

## Frontend Placement

Use the existing chat header artifact trigger next to `ExportTrigger` as the
primary entry. Rename/label it as "Result files" in English and "结果文件" in
Chinese, and show the artifact count when files exist. Clicking it opens the
existing right-side result files panel in `ChatBox`.

The existing inline `present_files` rendering can remain as a legacy fallback,
but it is not the primary integration point for the Qiongqi engine.

## Data Flow

Add a small artifact list client API and hook:

1. Fetch `/v1/threads/:id/artifacts` with the existing authenticated fetcher.
2. Map artifacts to their `virtualPath` values for current UI compatibility.
3. Load artifacts when an existing thread opens.
4. Refresh artifacts after terminal turn events: `turn_completed`,
   `turn_failed`, and `turn_aborted`.
5. Merge the fetched artifact paths into `thread.values.artifacts` so
   `ArtifactTrigger`, `ChatBox`, `ArtifactFileList`, and cached thread state all
   observe the same value.

The panel continues to use `ArtifactFileList`, `ArtifactFileDetail`,
`urlOfArtifact`, and `downloadArtifactUrl` for preview and download behavior.

## Error Handling

Artifact list failures should not break the conversation stream. If the fetch
fails, preserve the previous artifact list, log the failure for debugging, and
avoid showing a broken result entry. If the panel is open and no files are
available, keep the current empty state.

## Tests

Add focused frontend coverage:

- API mapping: `/v1/threads/:id/artifacts` response maps to virtual paths.
- Stream state: terminal turn refresh updates `thread.values.artifacts`.
- UI trigger: the result files trigger is hidden with zero files and visible
  with a count when artifacts exist.
- Existing artifact URL/download tests remain the coverage for content download.

## Scope

This change only wires thread-level result artifacts into the existing UI. It
does not redesign the file panel, does not add a project file browser entry, and
does not require the model to call the legacy `present_files` tool.
