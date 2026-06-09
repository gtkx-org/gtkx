import { beforeAll } from "vitest";

/**
 * Eagerly loads the GTKX runtime once the worker display is available.
 *
 * Importing `@gtkx/gl` pulls in `@gtkx/ffi`, which runs `gtk_init()` at
 * module-evaluation time and therefore requires an X display. Performing that
 * import inside `beforeAll` — rather than at this setup file's top level —
 * guarantees it runs after every setup file body, including the
 * `@gtkx/vitest` worker setup that spawns Xvfb and exports `DISPLAY`.
 */
beforeAll(async () => {
    await import("@gtkx/gl");
});
