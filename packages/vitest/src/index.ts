import { join } from "node:path";

import { createGtkxConfigPlugin } from "@gtkx/config";
import type { Plugin } from "vitest/config";
import { gtkxBundledModulePatterns } from "./bundled-modules.js";
import type { HeadlessOptions } from "./headless-display.js";

export type GtkxPluginOptions = Partial<HeadlessOptions>;

declare module "vitest" {
    interface ProvidedContext {
        gtkxHeadless: GtkxPluginOptions;
    }
}

const gtkx = (options: GtkxPluginOptions = {}): Plugin => {
    const workerSetupPath = join(import.meta.dirname, "worker-setup.js");

    return createGtkxConfigPlugin({
        name: "gtkx:vitest",
        config(config) {
            const setupFiles = config.test?.setupFiles ?? [];

            return {
                test: {
                    setupFiles: [workerSetupPath, ...(Array.isArray(setupFiles) ? setupFiles : [setupFiles])],
                    provide: { gtkxHeadless: options },
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
