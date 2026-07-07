import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createGtkxConfigPlugin } from "@gtkx/config/plugin";
import type { Plugin } from "vitest/config";
import { type HeadlessOptions, STATIC_HEADLESS_ENV } from "./headless-display.js";

export type GtkxPluginOptions = Partial<HeadlessOptions>;

const workerPreloadUrl = (): string => {
    const sibling = join(import.meta.dirname, "worker-preload.js");
    if (existsSync(sibling)) return pathToFileURL(sibling).href;
    return pathToFileURL(join(import.meta.dirname, "..", "dist", "worker-preload.js")).href;
};

const headlessBootstrapModule = (options: GtkxPluginOptions): string => {
    const source = [
        `import { bootstrapHeadlessDisplay } from ${JSON.stringify(workerPreloadUrl())};`,
        `await bootstrapHeadlessDisplay(${JSON.stringify(options)});`,
        "",
    ].join("\n");
    return `data:text/javascript,${encodeURIComponent(source)}`;
};

const gtkx = (options: GtkxPluginOptions = {}): Plugin =>
    createGtkxConfigPlugin({
        name: "gtkx:vitest",
        config() {
            return {
                test: {
                    globals: true,
                    execArgv: ["--import", headlessBootstrapModule(options)],
                    testTimeout: 20000,
                    hookTimeout: 20000,
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
