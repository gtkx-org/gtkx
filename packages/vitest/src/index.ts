import type { Plugin } from "vitest/config";
import { assertSupportedNodeVersion, createConfigLoader } from "@gtkx/config/internal";
import createConfigPlugin from "@gtkx/config/vite-plugin";
import { type HeadlessOptions, resolveHeadlessExecutables, STATIC_HEADLESS_ENV } from "./headless-display.ts";
import { reapStaleHeadlessDisplaysAtStartup } from "./reap-headless-displays.ts";

/**
 * Options accepted by the GTKX Vitest plugin. Every headless display
 * setting is optional and falls back to a built-in default when omitted.
 */
type PluginOptions = Partial<HeadlessOptions> &
    Partial<Record<"configFile", string | undefined>> & {
        /** Compiled gettext catalog directory, resolved relative to the test project's root. */
        localeDir?: string | undefined;
    };

const GTKX_INLINE_DEPS: RegExp[] = [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/];
const DEFAULT_TIMEOUT = 30_000;
const SHARED_WORKER_MESSAGE = [
    "GTKX tests need Vitest's per-file isolation, but this run sets `isolate: false` (or `--no-isolate`).",
    "Each test file runs in its own worker process with its own GTK runtime and headless display, which GTKX shuts down when the file finishes.",
    "Remove `isolate: false` from the Vitest configuration and `--no-isolate` from the command line.",
].join("\n");

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
 * down when the worker exits normally, along with processes still running in that
 * runtime, such as GTK's sandboxed image loaders. Creating the plugin reaps orphaned
 * display helpers and stale `gtkx-xdg-*` runtime directories left behind
 * by earlier runs, which `gtkx cleanup` also does on demand.
 *
 * Test files always run in isolated workers: Vitest fails to start when a project
 * sets `isolate: false`, because GTKX shuts each worker's runtime down after its file.
 *
 * When Sway or `dbus-daemon` is missing from `PATH`, Vitest fails to start,
 * before any worker launches, with an error naming each missing tool. Loading
 * the configuration without starting Vitest does not require them.
 *
 * @param options Plugin options; the headless display `size` is forwarded to each worker.
 * @returns A Vitest config plugin.
 */
const gtkx = (options: PluginOptions = {}): Plugin => {
    assertSupportedNodeVersion();
    reapStaleHeadlessDisplaysAtStartup();
    const { configFile, localeDir, ...headlessOptions } = options;
    const loadConfig = createConfigLoader({ configFile });

    const configPlugin = createConfigPlugin({
        name: "gtkx:vitest",
        loadConfig,
        localeDir,
        config(config) {
            return {
                test: {
                    globals: true,
                    execArgv: ["--disable-sigusr1", "--import", headlessPreloadSpecifier(headlessOptions)],
                    testTimeout: config.test?.testTimeout ?? DEFAULT_TIMEOUT,
                    hookTimeout: config.test?.hookTimeout ?? DEFAULT_TIMEOUT,
                    pool: "forks",
                    isolate: config.test?.isolate ?? true,
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

    return {
        ...configPlugin,
        configureVitest({ project }) {
            if (!project.config.isolate) {
                throw new Error(SHARED_WORKER_MESSAGE);
            }

            resolveHeadlessExecutables();
        },
    };
};

export default gtkx;
export { type HeadlessOptions } from "./headless-display.ts";
export { type PluginOptions };
