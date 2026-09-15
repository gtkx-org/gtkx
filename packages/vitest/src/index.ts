import type { Plugin } from "vitest/config";
import { assertSupportedNodeVersion, createConfigLoader } from "@gtkx/config/internal";
import createConfigPlugin from "@gtkx/config/vite-plugin";
import { type HeadlessOptions, STATIC_HEADLESS_ENV } from "./headless-display.ts";
import { reapStaleHeadlessDisplaysAtStartup } from "./reap-headless-displays.ts";

/**
 * Options accepted by the GTKX Vitest plugin. Every headless display
 * setting is optional and falls back to a built-in default when omitted.
 */
type PluginOptions = Partial<HeadlessOptions> & Partial<Record<"configFile", string | undefined>>;

const GTKX_INLINE_DEPS: RegExp[] = [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/];
const DEFAULT_TIMEOUT = 30_000;

const headlessPreloadSpecifier = (options: Partial<HeadlessOptions>): string => {
    const url = new URL("worker-preload.js", import.meta.url);

    for (const [key, value] of Object.entries(options)) {
        url.searchParams.set(key, value);
    }

    return url.href;
};

/**
 * Vitest plugin that runs each test worker against its own isolated headless
 * Wayland display. It configures the forks pool, injects the worker preload and
 * setup files, and sets the environment needed for headless GTK4 rendering.
 *
 * Each worker's compositor, session bus, and private runtime directory are torn
 * down when the worker exits, and a guard process tears them down as well when
 * the worker or the Vitest process that launched it is killed with `SIGKILL`.
 * Creating the plugin reaps stale `gtkx-xdg-*` runtime directories left behind
 * by earlier runs, which `gtkx cleanup` also does on demand.
 *
 * @param options Headless display settings (size, compositor) forwarded to each worker.
 * @returns A Vitest config plugin.
 */
const gtkx = (options: PluginOptions = {}): Plugin => {
    assertSupportedNodeVersion();
    reapStaleHeadlessDisplaysAtStartup();
    const { configFile, ...headlessOptions } = options;
    const loadConfig = createConfigLoader({ configFile });

    return createConfigPlugin({
        name: "gtkx:vitest",
        loadConfig,
        config(config) {
            return {
                test: {
                    globals: true,
                    execArgv: ["--disable-sigusr1", "--import", headlessPreloadSpecifier(headlessOptions)],
                    testTimeout: config.test?.testTimeout ?? DEFAULT_TIMEOUT,
                    hookTimeout: config.test?.hookTimeout ?? DEFAULT_TIMEOUT,
                    pool: "forks",
                    env: STATIC_HEADLESS_ENV,
                    server: {
                        deps: {
                            inline: GTKX_INLINE_DEPS,
                        },
                    },
                },
            };
        },
    });
};

export default gtkx;
export { type CompositorId, type HeadlessOptions } from "./headless-display.ts";
export { type PluginOptions };
