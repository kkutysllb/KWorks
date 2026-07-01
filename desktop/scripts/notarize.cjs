/**
 * electron-builder `afterSign` hook: Apple notarization + stapling.
 *
 * Runs AFTER the .app is codesigned, BEFORE it is packed into the DMG/ZIP.
 * Notarization submits the app to Apple's notary service; once approved the
 * ticket is stapled to the bundle so macOS Gatekeeper accepts it offline.
 *
 * ── When does it run? ─────────────────────────────────────────────
 * Only on macOS (`electronPlatformName === "darwin"`). On Windows/Linux this
 * hook is a no-op.
 *
 * ── Credentials ───────────────────────────────────────────────────
 * Reads from environment variables so secrets never touch the repo:
 *   - APPLE_ID                        (e.g. you@icloud.com)
 *   - APPLE_APP_SPECIFIC_PASSWORD     (app-specific password from appleid.apple.com)
 *   - APPLE_TEAM_ID                   (e.g. DHV5D72JNF)
 *
 * If ANY of these is missing, notarization is SKIPPED with a notice. This
 * lets local dev builds (`pnpm build:app` without secrets) succeed, while CI
 * release builds set the env vars and get a fully notarized artifact.
 *
 * Uses `notarytool` (Apple's current API; `altool` was deprecated in 2023).
 * Requires Xcode 13+ on the build machine — `macos-latest` GitHub runners
 * ship with a recent Xcode, and the local Mac has Xcode/Command Line Tools.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { notarize } = require("@electron/notarize");

/** @param {{ electronPlatformName: string; appOutDir: string; packager: { appInfo: { productFilename: string; id: string } } }} context */
exports.default = async function notarizeAfterSign(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== "darwin") {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log(
      "[notarize] ⏭️  跳过公证 — 未设置 APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID",
    );
    console.log(
      "[notarize]    本地开发构建无需公证；CI 发布请在 GitHub Secrets 中配置上述变量。",
    );
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appBundleId = packager.appInfo.id;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] 📤 提交公证: ${appPath}`);
  console.log(`[notarize]    bundleId=${appBundleId} teamId=${teamId} appleId=${appleId}`);

  const startedAt = Date.now();
  await notarize({
    tool: "notarytool",
    appBundleId,
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[notarize] ✅ 公证通过并已自动装订票据 (${elapsed}s)`);
  console.log("[notarize] ✅ 应用已就绪，可分发（Gatekeeper 离线可验证）");
};
