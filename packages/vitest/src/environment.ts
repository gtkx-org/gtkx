import type { Environment } from "vitest/runtime";
import { DEFAULT_HEADLESS_SIZE, type HeadlessOptions, startHeadlessDisplay } from "./headless-display.js";

/**
 * Vitest environment that provisions an isolated headless Wayland display for
 * each test worker. The display is started during {@link Environment.setup}; on
 * process exit the temporary runtime directory and session bus are torn down,
 * while the compositor carries a parent-death signal and is reaped by the kernel
 * only once the worker process terminates — which is after the native GLib main
 * loop has already quit — so GTK never observes its compositor disappearing
 * while it is still iterating.
 */
const gtkxEnvironment: Environment = {
    name: "gtkx",
    viteEnvironment: "ssr",
    async setup(_global, options: Partial<HeadlessOptions>) {
        const teardown = await startHeadlessDisplay({
            size: options.size ?? DEFAULT_HEADLESS_SIZE,
            compositor: options.compositor ?? "weston",
        });

        let torndown = false;
        process.on("exit", () => {
            if (torndown) return;
            torndown = true;
            teardown();
        });

        return {
            teardown() {},
        };
    },
};

export default gtkxEnvironment;
