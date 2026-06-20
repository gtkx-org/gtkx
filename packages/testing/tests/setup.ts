import { afterEach } from "vitest";

/**
 * `@gtkx/testing` transitively imports `@gtkx/ffi`, whose module evaluation
 * runs `gtk_init()`. Importing it inside the hook — which runs after the
 * `@gtkx/vitest` worker setup has brought up the headless Wayland compositor —
 * keeps a display-less `gtk_init()` from aborting the worker while setup files load.
 */
afterEach(async () => {
    const { cleanup } = await import("../src/index.js");
    await cleanup();
});
