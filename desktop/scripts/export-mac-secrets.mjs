#!/usr/bin/env node
/**
 * 导出 macOS 签名/公证所需的 GitHub Secrets。
 *
 * 用法:
 *   node scripts/export-mac-secrets.mjs [path/to/cert.p12]
 *
 * 做什么:
 *   1. 读取 Developer ID Application 的 .p12 文件，转成 base64（用于 MAC_CERTIFICATE）
 *   2. 若 `gh` 已登录，自动把 MAC_CERTIFICATE 写入仓库 Secrets（通过 stdin，base64 不落盘、不出现在命令行）
 *   3. 打印其余 4 个 secret 的 `gh secret set` 命令（会交互式提示输入，密码自动隐藏）
 *
 * 安全:
 *   - base64 只在内存中传递给 `gh secret set`，不写入任何文件
 *   - 其余敏感值（Apple ID、密码）由 `gh secret set` 交互式收集，本脚本不接触
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const DEFAULT_P12 =
  process.env.HOME + "/Documents/OClaw证书.p12";
const p12Path = process.argv[2] || DEFAULT_P12;

const TEAM_ID = "DHV5D72JNF"; // 从钥匙串证书名提取，可改

// ─── banner ──────────────────────────────────────────────────────────────
const BANNER = `
╔══════════════════════════════════════════════════════════════════════╗
║   KWorks Desktop — GitHub Release Secrets 配置助手                    ║
║   package: ${pkg.name}  version: ${pkg.version.padEnd(14)}            ║
╚══════════════════════════════════════════════════════════════════════╝
`.trim();

console.log(BANNER + "\n");

// ─── 1. 读取 .p12 ────────────────────────────────────────────────────────
if (!existsSync(p12Path)) {
  console.error(`❌ 证书文件不存在: ${p12Path}`);
  console.error(`   用法: node scripts/export-mac-secrets.mjs <path/to/cert.p12>`);
  console.error(`   默认路径: ${DEFAULT_P12}`);
  process.exit(1);
}

const buf = readFileSync(p12Path);
const b64 = buf.toString("base64");
const sizeKb = (buf.length / 1024).toFixed(1);

console.log(`✅ 已读取证书: ${p12Path}`);
console.log(`   大小: ${sizeKb} KB → base64: ${(b64.length / 1024).toFixed(1)} KB\n`);

// ─── 2. 检查 gh 登录状态 ─────────────────────────────────────────────────
let ghLoggedIn = false;
let ghRepo = null;
try {
  const status = execSync("gh auth status 2>&1", { encoding: "utf8" });
  ghLoggedIn = /Logged in to github\.com/.test(status);
} catch {
  ghLoggedIn = false;
}
try {
  ghRepo = execSync("gh repo view --json nameWithOwner -q .nameWithOwner", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  }).trim();
} catch {
  ghRepo = null;
}

// ─── 3a. gh 已登录 → 自动设置 MAC_CERTIFICATE ────────────────────────────
if (ghLoggedIn && ghRepo) {
  console.log(`✅ gh 已登录，仓库: ${ghRepo}`);
  console.log("\n⏳ 正在设置 MAC_CERTIFICATE（从 .p12 自动生成）...");
  const r = spawnSync("gh", ["secret", "set", "MAC_CERTIFICATE"], {
    input: b64,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (r.status === 0) {
    console.log("✅ MAC_CERTIFICATE 设置成功\n");
  } else {
    console.error("❌ 设置 MAC_CERTIFICATE 失败，请手动设置（见下方）\n");
  }

  console.log("─".repeat(64));
  console.log("接下来请依次运行以下命令（gh 会交互式提示输入，密码自动隐藏）：\n");
  console.log("─".repeat(64));
  console.log(`# 2. .p12 导出密码（创建证书时设置的密码）`);
  console.log(`gh secret set MAC_CERTIFICATE_PWD\n`);
  console.log(`# 3. Apple ID 邮箱`);
  console.log(`gh secret set APPLE_ID\n`);
  console.log(`# 4. 应用专用密码（在 https://appleid.apple.com → 登录与安全 → 应用专用密码 生成）`);
  console.log(`gh secret set APPLE_APP_SPECIFIC_PASSWORD\n`);
  console.log(`# 5. 团队 ID（默认 ${TEAM_ID}，直接回车用默认值）`);
  console.log(`gh secret set APPLE_TEAM_ID\n`);
  console.log("─".repeat(64));
  console.log("\n全部设置完成后，即可触发发布：\n");
  console.log("  # 方式 A：打 tag 自动触发（推荐，用于正式发布）");
  console.log(`  git tag v${pkg.version}`);
  console.log(`  git push origin v${pkg.version}\n`);
  console.log("  # 方式 B：Actions 页面手动运行（默认草稿模式，用于测试）");
  console.log(`  gh workflow run release.yml\n`);
}
// ─── 3b. gh 未登录 → 打印完整手动指南 ───────────────────────────────────
else {
  console.log("⚠️  gh 未登录或未关联仓库。请先登录：\n");
  console.log("  gh auth login\n");
  console.log("登录后重新运行本脚本，可自动设置 MAC_CERTIFICATE。\n");
  console.log("─".repeat(64));
  console.log("或者，手动在 GitHub 网页配置 Secrets：\n");
  console.log(`  仓库 → Settings → Secrets and variables → Actions → New repository secret\n`);
  console.log("需要配置的 5 个 Secret：\n");
  console.log("  ┌─────────────────────────────┬───────────────────────────────────────────────┐");
  console.log("  │ Secret 名称                  │ 值说明                                          │");
  console.log("  ├─────────────────────────────┼───────────────────────────────────────────────┤");
  console.log(`  │ MAC_CERTIFICATE              │ 下面 ⬇️ 的 base64 字符串（选中全部复制）          │`);
  console.log("  │ MAC_CERTIFICATE_PWD          │ .p12 导出时设置的密码                            │");
  console.log("  │ APPLE_ID                     │ 你的 Apple ID 邮箱                              │");
  console.log("  │ APPLE_APP_SPECIFIC_PASSWORD  │ appleid.apple.com 生成的应用专用密码             │");
  console.log(`  │ APPLE_TEAM_ID                │ ${TEAM_ID}                                    │`);
  console.log("  └─────────────────────────────┴───────────────────────────────────────────────┘\n");
  console.log("─".repeat(64));
  console.log("📎 MAC_CERTIFICATE 的 base64 值（复制下面这一整段）：\n");
  console.log(b64);
  console.log("\n" + "─".repeat(64));
}
