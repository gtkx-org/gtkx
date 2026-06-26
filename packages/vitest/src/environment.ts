import type { Environment } from "vitest/runtime";
import { DEFAULT_HEADLESS_SIZE, type HeadlessOptions, startHeadlessDisplay } from "./headless-display.js";

/**
 * Vitest environment that provisions an isolated headless Wayland display for
 * each test worker. The display is started during {@link Environment.setup} and
 * torn down on process exit — after the worker has already stopped — so GTK
 * never observes its compositor disappearing while the native main loop is still
 * running.
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
