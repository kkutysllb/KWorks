const requested = process.argv[2] ?? "frontend";

console.error(
  `[frontend] '${requested}' is disabled because KWorks is Electron-only.\n` +
    "Use `pnpm -C ../desktop dev` for development or " +
    "`pnpm -C ../desktop build:app` for packaging. " +
    "Renderer E2E coverage must be launched from Electron.",
);

process.exit(1);
