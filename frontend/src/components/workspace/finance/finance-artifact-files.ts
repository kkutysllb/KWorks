const AUXILIARY_MARKDOWN_FRAGMENTS = [
  "audit",
  "one_liner",
  "one-liner",
  "readme",
  "审计",
  "一句话",
];

const SEMANTIC_REPORT_FRAGMENTS = ["report", "analysis", "报告", "分析"];

interface PathParts {
  basename: string;
  directory: string;
  extension: string;
  stem: string;
}

function pathParts(path: string): PathParts {
  const normalizedPath = path.replaceAll("\\", "/");
  const separatorIndex = normalizedPath.lastIndexOf("/");
  const basename = normalizedPath.slice(separatorIndex + 1);
  const extensionIndex = basename.lastIndexOf(".");
  const hasExtension = extensionIndex > 0;

  return {
    basename,
    directory:
      separatorIndex === -1 ? "" : normalizedPath.slice(0, separatorIndex),
    extension: hasExtension ? basename.slice(extensionIndex).toLowerCase() : "",
    stem: (hasExtension
      ? basename.slice(0, extensionIndex)
      : basename
    ).toLowerCase(),
  };
}

function includesFragment(
  value: string,
  fragments: readonly string[],
): boolean {
  return fragments.some((fragment) => value.includes(fragment));
}

function latestMatching(
  paths: readonly string[],
  predicate: (parts: PathParts) => boolean,
): string | undefined {
  for (let index = paths.length - 1; index >= 0; index -= 1) {
    const path = paths[index];
    if (path !== undefined && predicate(pathParts(path))) return path;
  }
  return undefined;
}

export function isHtmlArtifact(path: string): boolean {
  return pathParts(path).extension === ".html";
}

export function resolveFinanceMarkdownArtifact(
  htmlPath: string,
  artifacts: readonly string[],
): string | undefined {
  const markdownPaths = artifacts.filter(
    (path) => pathParts(path).extension === ".md",
  );
  if (markdownPaths.length === 0) return undefined;

  const normalMarkdownPaths = markdownPaths.filter(
    (path) =>
      !includesFragment(pathParts(path).stem, AUXILIARY_MARKDOWN_FRAGMENTS),
  );
  const eligiblePaths =
    normalMarkdownPaths.length > 0 ? normalMarkdownPaths : markdownPaths;
  const html = pathParts(htmlPath);
  const isSameDirectory = (parts: PathParts) =>
    parts.directory === html.directory;

  return (
    latestMatching(
      eligiblePaths,
      (parts) => isSameDirectory(parts) && parts.stem === html.stem,
    ) ??
    latestMatching(
      eligiblePaths,
      (parts) =>
        isSameDirectory(parts) &&
        includesFragment(parts.stem, SEMANTIC_REPORT_FRAGMENTS),
    ) ??
    latestMatching(eligiblePaths, isSameDirectory) ??
    eligiblePaths.at(-1)
  );
}
