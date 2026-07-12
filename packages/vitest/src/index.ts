import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import createConfigPlugin from "@gtkx/config/vite-plugin";
import type { Plugin } from "vitest/config";
import { type HeadlessOptions, STATIC_HEADLESS_ENV } from "./headless-display.js";

/**
 * Options accepted by the {@link gtkx} Vitest plugin. Every headless display
 * setting is optional and falls back to a built-in default when omitted.
 */
export type GtkxPluginOptions = Partial<HeadlessOptions>;

const workerPreloadUrl = (): URL => {
    const sibling = join(import.meta.dirname, "worker-preload.js");
    const path = existsSync(sibling) ? sibling : join(import.meta.dirname, "..", "dist", "worker-preload.js");
    return pathToFileURL(path);
};

const headlessPreloadSpecifier = (options: GtkxPluginOptions): string => {
    const url = workerPreloadUrl();
    for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) url.searchParams.set(key, value);
    }
    return url.href;
};

const workerSetupPath = (): string => {
    const sibling = join(import.meta.dirname, "worker-setup.js");
    return existsSync(sibling) ? sibling : join(import.meta.dirname, "..", "dist", "worker-setup.js");
};

/**
 * Vitest plugin that runs each test worker against its own isolated headless
 * Wayland display. It configures the forks pool, injects the worker preload and
 * setup files, and sets the environment needed for headless GTK rendering.
 *
 * @param options Headless display settings (size, compositor) forwarded to each worker.
 * @returns A Vitest config plugin.
 */
const gtkx = (options: GtkxPluginOptions = {}): Plugin =>
    createConfigPlugin({
        name: "gtkx:vitest",
        config() {
            return {
                test: {
                    globals: true,
                    execArgv: ["--import", headlessPreloadSpecifier(options)],
                    setupFiles: [workerSetupPath()],
                    testTimeout: 30000,
                    hookTimeout: 30000,
                    pool: "forks",
                    env: STATIC_HEADLESS_ENV,
                    server: {
                        deps: {
                            inline: [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/],
                        },
                    },
                },
            };
        },
    });

export default gtkx;
