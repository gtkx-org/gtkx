import { join } from "node:path";

import { createGtkxConfigPlugin, gtkxBundledModulePatterns } from "@gtkx/config";
import type { Plugin } from "vitest/config";
import type { HeadlessOptions } from "./headless-environment.js";

export type GtkxPluginOptions = Partial<HeadlessOptions>;

const gtkx = (options: GtkxPluginOptions = {}): Plugin => {
    const workerSetupPath = join(import.meta.dirname, "worker-setup.js");

    if (options.size !== undefined) process.env["GTKX_HEADLESS_SIZE"] = options.size;
    if (options.compositor !== undefined) process.env["GTKX_COMPOSITOR"] = options.compositor;

    return createGtkxConfigPlugin({
        name: "gtkx:vitest",
        config(config) {
            const setupFiles = config.test?.setupFiles ?? [];

            return {
                test: {
                    setupFiles: [workerSetupPath, ...(Array.isArray(setupFiles) ? setupFiles : [setupFiles])],
                    testTimeout: 20000,
                    hookTimeout: 20000,
                    pool: "forks",
                    server: {
                        deps: {
                            inline: [...gtkxBundledModulePatterns],
                        },
                    },
                },
                ssr: {
                    resolve: {
                        conditions: ["source", "module", "node", "development|production"],
                    },
                },
            };
        },
    });
};

export default gtkx;
