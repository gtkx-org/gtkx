import { DEFAULT_HEADLESS_SIZE, type HeadlessOptions, startHeadlessDisplay } from "./headless-display.js";

type EnvironmentTeardown = () => void;

type EnvironmentReturn = {
    teardown: EnvironmentTeardown;
};

type GtkxEnvironment = {
    name: string;
    viteEnvironment: "ssr";
    setup: (global: unknown, options: Partial<HeadlessOptions>) => Promise<EnvironmentReturn>;
};

/**
 * Vitest environment that provisions an isolated headless Wayland display for
 * each test worker. The display is started during {@link GtkxEnvironment.setup}
 * and torn down through the returned handle when the worker finishes.
 */
const gtkxEnvironment: GtkxEnvironment = {
    name: "gtkx",
    viteEnvironment: "ssr",
    async setup(_global, options) {
        const teardown = await startHeadlessDisplay({
            size: options.size ?? DEFAULT_HEADLESS_SIZE,
            compositor: options.compositor ?? "weston",
        });

        return {
            teardown() {
                teardown();
            },
        };
    },
};

export default gtkxEnvironment;
