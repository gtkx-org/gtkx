import type { Environment } from "vitest/runtime";
import { DEFAULT_HEADLESS_SIZE, type HeadlessOptions, startHeadlessDisplay } from "./headless-display.js";

/**
 * Vitest environment that provisions an isolated headless Wayland display for
 * each test worker. The display is started during {@link Environment.setup} and
 * torn down through the returned handle when the worker finishes.
 */
const gtkxEnvironment: Environment = {
    name: "gtkx",
    viteEnvironment: "ssr",
    async setup(_global, options: Partial<HeadlessOptions>) {
        const teardown = await startHeadlessDisplay({
            size: options.size ?? DEFAULT_HEADLESS_SIZE,
            compositor: options.compositor ?? "weston",
        });

        return { teardown };
    },
};

export default gtkxEnvironment;
