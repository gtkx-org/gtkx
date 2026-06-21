import { join } from "node:path";

import { createGtkxConfigPlugin, gtkxBundledModulePatterns } from "@gtkx/config";
import type { Plugin } from "vitest/config";

const gtkx = (): Plugin => {
    const workerSetupPath = join(import.meta.dirname, "setup.js");

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
