import { join } from "node:path";

import { createGtkxConfigPlugin, gtkxBundledModulePatterns } from "@gtkx/config";
import type { Plugin } from "vitest/config";
import type { CompositorId } from "./headless-display.js";

export type GtkxHeadlessOptions = {
    size?: string;
    compositor?: CompositorId;
};

const gtkx = (options: GtkxHeadlessOptions = {}): Plugin => {
    const workerSetupPath = join(import.meta.dirname, "setup.js");

    if (options.size !== undefined) process.env["GTKX_HEADLESS_SIZE"] = options.size;
    if (options.compositor !== undefined) process.env["GTKX_COMPOSITOR"] = options.compositor;

    return createGtkxConfigPlugin({
        name: "gtkx",
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
