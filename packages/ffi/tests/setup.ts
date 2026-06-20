import { beforeAll } from "vitest";

/**
 * Eagerly loads the GTKX runtime once the worker display is available.
 *
 * Importing `@gtkx/ffi` runs `gtk_init()` at module-evaluation time, which
 * requires a display. Performing that import inside `beforeAll` — rather
 * than at this setup file's top level — guarantees it runs after every setup
 * file body, including the `@gtkx/vitest` worker setup that spawns the headless
 * Wayland compositor and exports `WAYLAND_DISPLAY`.
 */
beforeAll(async () => {
    await import("@gtkx/ffi");
});
