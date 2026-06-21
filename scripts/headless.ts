/**
 * Single source of truth for the headless software-render environment used to
 * run GTK under CI and tests without a real GPU or display server.
 *
 * Every site that launches GTK headlessly (native cargo tests/coverage, the
 * CodSpeed benchmark runner, and the Vitest display harness) renders through
 * the same Cairo software path with Vulkan disabled, so the renderer policy
 * lives here rather than being copied into each invocation.
 */

/**
 * Environment variables that force GTK to render through the headless Cairo
 * software path with Vulkan and hardware OpenGL disabled.
 *
 * Spread this into the environment of any process that drives GTK without a
 * display, e.g. `{ ...process.env, ...HEADLESS_RENDER_ENV }`.
 */
export const HEADLESS_RENDER_ENV = {
    GDK_BACKEND: "wayland",
    GSK_RENDERER: "cairo",
    LIBGL_ALWAYS_SOFTWARE: "1",
    GDK_DISABLE: "vulkan",
};

/**
 * Command and arguments that wrap a child process in a headless Weston
 * compositor via `wlheadless-run`.
 *
 * @param command - The executable to launch inside the headless compositor.
 * @param args - Arguments forwarded to {@link command}.
 * @returns A `[command, args]` tuple ready to pass to a process spawner.
 */
export function wlheadless(command: string, args: string[]): [string, string[]] {
    return ["wlheadless-run", ["-c", "weston", "--", command, ...args]];
}
