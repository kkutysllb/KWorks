/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 */
import "./src/env.js";

const isDesktopBuild =
  process.env.DESKTOP_BUILD === "true" || process.env.DESKTOP_BUILD === "1";
const desktopDevOrigins = ["127.0.0.1", "localhost"];

/** @type {import("next").NextConfig} */
const config = {
  allowedDevOrigins: desktopDevOrigins,
  ...(isDesktopBuild
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {}),
  devIndicators: false,
};

export default config;
