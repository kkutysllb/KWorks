// Side-effect import: registers the global `Window.kworksDesktop` augmentation
// so this module can read the bridge in a type-safe way.
import "@/core/desktop/types";

/**
 * The preload bridge exposed on `window.kworksDesktop` by Electron.
 *
 * Detection is intentionally a single existence check so the rest of the
 * frontend can branch on `isDesktop()` without importing any Electron
 * surface directly. When this property is absent the renderer is running in
 * an unsupported standalone browser session.
 */
const DESKTOP_BRIDGE_KEY = "kworksDesktop";
// Historical Electron dev port; kept only as a final fallback for shells that
// never set `frontendPort` on the bridge.
const LEGACY_ELECTRON_DEV_PORT = "18659";

let _desktopPort: number =
  typeof window !== "undefined" && window.kworksDesktop?.gatewayPort != null
    ? window.kworksDesktop.gatewayPort
    : 19987;

export async function initGatewayPort(): Promise<void> {
  if (!isDesktop()) return;
  try {
    const cfg = await window.kworksDesktop?.getGatewayConfig();
    if (cfg?.port) _desktopPort = cfg.port;
  } catch {
    // fallback to default port
  }
}

export function isDesktop(): boolean {
  return (
    typeof window !== "undefined" && DESKTOP_BRIDGE_KEY in window
  );
}

/**
 * Resolve the dev-server port the current shell is loading the renderer from.
 *
 * Priority:
 * 1. `window.kworksDesktop.frontendPort` — Electron shells can report the
 *    actual dev-server port so this stays port-independent.
 * 2. `18659` — default Electron dev port.
 *
 * Returns `null` for packaged shells that serve the renderer from a custom
 * scheme (e.g. `app://-`) and therefore have no TCP port at all.
 */
function getDesktopDevPort(): string | null {
  if (typeof window === "undefined") return null;
  const fromBridge = window.kworksDesktop?.frontendPort;
  if (fromBridge != null && Number.isFinite(fromBridge)) {
    return String(fromBridge);
  }
  return LEGACY_ELECTRON_DEV_PORT;
}

/**
 * Electron renderer loaded from the Next.js dev server.
 *
 * In this mode the gateway is owned by the Electron dev launcher. API calls
 * still go directly to the gateway; the Next dev server is only the renderer
 * hot-reload host.
 */
export function isDesktopDevMode(): boolean {
  if (!isDesktop() || typeof window === "undefined") return false;
  const devPort = getDesktopDevPort();
  if (devPort === null) return false;
  return window.location.port === devPort;
}

/**
 * Desktop mode where Electron's BackendManager owns the gateway lifecycle.
 *
 * Packaged desktop uses this path; desktop dev does not, because the dev
 * launcher starts and respawns the gateway process.
 */
export function isDesktopBackendManagedMode(): boolean {
  return isDesktop() && !isDesktopDevMode();
}

function requireDesktopBridge(): void {
  if (!isDesktop()) {
    throw new Error(
      "KWorks must be launched through Electron; Electron desktop bridge is unavailable.",
    );
  }
}

export function getBackendBaseURL(): string {
  requireDesktopBridge();
  return `http://127.0.0.1:${_desktopPort}`;
}

export function getRuntimeApiBaseURL(isMock?: boolean): string {
  requireDesktopBridge();
  return `${getBackendBaseURL()}${isMock ? "/mock/api" : "/api"}`;
}
