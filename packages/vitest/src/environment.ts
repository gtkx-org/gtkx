import type { Environment } from "vitest/runtime";
import { DEFAULT_HEADLESS_SIZE, type HeadlessOptions, startHeadlessDisplay } from "./headless-display.js";

/**
 * Vitest environment that provisions an isolated headless Wayland display for
 * each test worker. The display is started during {@link Environment.setup} and
 * torn down from {@link Environment.teardown}, which Vitest invokes during its
 * graceful worker "stop" while the worker is still alive — by which point every
 * test's React tree has been unmounted — so the compositor is killed before
 * Vitest sends the worker SIGTERM. A `process.on("exit")` handler is kept as a
 * fallback for any non-graceful exit. Deferring teardown to process exit alone is
 * unsafe: Vitest terminates forks workers with SIGTERM, on which Node runs no
 * "exit" handlers, so the compositor would instead be reaped by its parent-death
 * signal at the same instant the worker dies and GTK would abort the worker on
 * "Lost connection to Wayland compositor" mid-flight.
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
        const runTeardown = (): void => {
            if (torndown) return;
            torndown = true;
            teardown();
        };
        process.on("exit", runTeardown);

        return {
            teardown: runTeardown,
        };
    },
};

export default gtkxEnvironment;
