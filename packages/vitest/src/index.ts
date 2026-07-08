import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createGtkxConfigPlugin } from "@gtkx/config/plugin";
import type { Plugin } from "vitest/config";
import { type HeadlessOptions, STATIC_HEADLESS_ENV } from "./headless-display.js";

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

const gtkx = (options: GtkxPluginOptions = {}): Plugin =>
    createGtkxConfigPlugin({
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
