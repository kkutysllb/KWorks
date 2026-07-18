// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";

// Mock @/env before importing config
vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_BACKEND_BASE_URL: "",
    NEXT_PUBLIC_RUNTIME_API_BASE_URL: "",
  },
}));

import {
  getBackendBaseURL,
  getRuntimeApiBaseURL,
  isDesktop,
  isDesktopBackendManagedMode,
  isDesktopDevMode,
} from "@/core/config";

/** Helper: install/remove the Electron preload bridge on `window`. */
function setDesktopBridge(present: boolean) {
  const w = window as unknown as Record<string, unknown>;
  if (present) {
    w.kworksDesktop = { gatewayPort: 19987 };
  } else {
    delete w.kworksDesktop;
  }
}

/** Helper: stub `window.location.port` for the duration of a test. */
function stubLocationPort(port: string, origin?: string) {
  Object.defineProperty(window, "location", {
    value: {
      ...window.location,
      port,
      origin: origin ?? `http://localhost:${port}`,
    },
    writable: true,
  });
}

describe("isDesktop", () => {
  afterEach(() => {
    setDesktopBridge(false);
  });

  test("returns false in a regular browser", () => {
    setDesktopBridge(false);
    expect(isDesktop()).toBe(false);
  });

  test("returns true when window.kworksDesktop is present", () => {
    setDesktopBridge(true);
    expect(isDesktop()).toBe(true);
  });
});

describe("desktop runtime mode", () => {
  afterEach(() => {
    setDesktopBridge(false);
  });

  test("detects Electron dev mode only on the desktop dev server port", () => {
    setDesktopBridge(true);
    stubLocationPort("18659");
    expect(isDesktopDevMode()).toBe(true);
    expect(isDesktopBackendManagedMode()).toBe(false);
  });

  test("treats packaged desktop as Electron-managed backend mode", () => {
    setDesktopBridge(true);
    stubLocationPort("");
    expect(isDesktopDevMode()).toBe(false);
    expect(isDesktopBackendManagedMode()).toBe(true);
  });

  test("does not mark regular web mode as desktop dev or desktop-managed", () => {
    setDesktopBridge(false);
    stubLocationPort("18659");
    expect(isDesktopDevMode()).toBe(false);
    expect(isDesktopBackendManagedMode()).toBe(false);
  });
});

describe("getBackendBaseURL", () => {
  afterEach(() => {
    setDesktopBridge(false);
  });

  test("rejects regular browser mode because KWorks is Electron-only", () => {
    setDesktopBridge(false);
    expect(() => getBackendBaseURL()).toThrow("Electron desktop bridge");
  });

  test("returns direct gateway URL in desktop dev mode (port 18659)", () => {
    setDesktopBridge(true);
    stubLocationPort("18659");
    expect(getBackendBaseURL()).toBe("http://127.0.0.1:19987");
  });

  test("returns direct gateway URL in desktop production mode (non-18659 port)", () => {
    setDesktopBridge(true);
    stubLocationPort("");
    const url = getBackendBaseURL();
    expect(url).toContain("127.0.0.1");
    expect(url).toContain("19987");
  });

  test("returns correct default gateway port in production mode", () => {
    setDesktopBridge(true);
    stubLocationPort("");
    const url = getBackendBaseURL();
    expect(url).toBe("http://127.0.0.1:19987");
  });
});

describe("getRuntimeApiBaseURL", () => {
  afterEach(() => {
    setDesktopBridge(false);
  });

  test("rejects regular browser mode because KWorks is Electron-only", () => {
    setDesktopBridge(false);
    expect(() => getRuntimeApiBaseURL()).toThrow("Electron desktop bridge");
  });

  test("returns direct gateway URL in desktop dev mode (port 18659)", () => {
    setDesktopBridge(true);
    stubLocationPort("18659", "http://localhost:18659");
    const url = getRuntimeApiBaseURL();
    expect(url).toBe("http://127.0.0.1:19987/api");
  });

  test("returns direct gateway URL in desktop production mode", () => {
    setDesktopBridge(true);
    stubLocationPort("");
    const url = getRuntimeApiBaseURL();
    expect(url).toContain("127.0.0.1");
    expect(url).toContain("/api");
  });
});
