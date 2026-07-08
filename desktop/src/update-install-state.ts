/**
 * Shared flag indicating that an update install has been explicitly
 * requested via ``autoUpdater.quitAndInstall()``.
 *
 * Why this exists: ``quitAndInstall`` relies on Electron's normal quit
 * sequence — it calls ``app.quit()``, then installs/re-launches from the
 * ``will-quit`` / ``quit`` hooks (macOS Squirrel relaunch, or the forked
 * NSIS/AppImage installer on Windows/Linux). If anything in the quit path
 * calls ``app.exit(0)`` instead, those hooks never run and the app quits
 * without restarting or installing — exactly the bug where "restart to
 * update" silently exits and requires a manual re-open.
 *
 * The main process's ``before-quit`` handler checks this flag so it can
 * stand aside (set ``isQuitting``, drop the tray, then return without
 * ``preventDefault`` or ``app.exit``) and hand control back to
 * ``electron-updater``'s quit sequence.
 */

let updateInstallRequested = false;

/** Mark that an update install is in flight — called right before quitAndInstall(). */
export function markUpdateInstallRequested(): void {
  updateInstallRequested = true;
}

/** Clear the flag — called if quitAndInstall() throws, so later quits behave normally. */
export function clearUpdateInstallRequested(): void {
  updateInstallRequested = false;
}

/** True between ``quitAndInstall()`` being called and the process actually exiting. */
export function isUpdateInstallRequested(): boolean {
  return updateInstallRequested;
}
