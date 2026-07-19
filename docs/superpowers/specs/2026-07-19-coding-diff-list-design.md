# Coding Diff List Design

## Goal

Change the Coding workbench's change view from a two-column file-list/detail
layout to a single-column list. Each changed file remains visible as a row,
while the selected file expands inline below its row to show the unified diff.

## Existing Contract

- `CodingDiffPanel` owns the project diff query, selected file, diff scope,
  focused line, refresh state, and discard mutation.
- `selectedFilePath` may be supplied by the Coding workbench when another
  panel focuses a file. Matching files must still become selected.
- The first changed file remains the default selection when no external file
  is selected.
- Unified diff rendering keeps the existing line-number tracking, focused-line
  highlight, and 3,000-line render cap.
- Empty, non-Git, loading, and error states remain unchanged.

## Layout

1. Keep the panel header with file count, additions/deletions totals, refresh,
   and loading indicator.
2. Render a full-width scrollable list of changed-file entries.
3. Each entry has one compact button row containing status, path, additions,
   and deletions. Long paths truncate without changing row height.
4. The selected row uses the existing emerald selection treatment and exposes
   `aria-expanded="true"`.
5. The selected row renders an inline detail section immediately below it. The
   detail section contains the current/all scope toggle, selected-file undo
   action, error/truncation notices, and the unified diff.
6. Only one file is expanded at a time. Selecting another row moves the inline
   detail section to that row.

## Behavior

- Clicking a file row selects it and preserves the current diff scope.
- A workbench focus event selects the matching file and opens its inline diff.
- If the externally focused file has no diff, retain the existing notice and
  select the first available changed file.
- The discard confirmation and refetch behavior remain unchanged.
- The list is keyboard reachable through native buttons; no hover-only action
  is required.

## Testing

- Update the source-contract test to assert the single-column list structure
  and inline expansion markers, and reject the old `w-72`/`border-r` split
  container.
- Preserve existing assertions for scope switching, discard, refresh, status
  labels, diff truncation, and focused-line rendering.
- Run the full frontend Vitest suite, TypeScript check, targeted ESLint, and
  desktop static export build.

## Scope

Only `CodingDiffPanel` and its focused source-contract test are changed. No
backend API, diff parsing, or workbench routing changes are required.
