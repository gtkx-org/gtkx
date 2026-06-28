import { init, quit as nativeQuit } from "./index.js";

export * from "./index.js";

let mainLoop = init();

/**
 * Quits the GLib main loop spawned when this module was imported and joins its
 * thread. Idempotent: subsequent calls are no-ops. The runtime is
 * single-lifecycle and cannot be re-initialized after this returns.
 */
export function quit() {
    if (!mainLoop) return;
    nativeQuit(mainLoop);
    mainLoop = null;
}
