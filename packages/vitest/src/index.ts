import { join } from "node:path";

import { createGtkxConfigPlugin } from "@gtkx/config";
import type { Plugin } from "vitest/config";
import type { HeadlessOptions } from "./headless-display.js";

export type GtkxPluginOptions = Partial<HeadlessOptions>;

const inlineDepsPatterns: RegExp[] = [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/];

const gtkx = (options: GtkxPluginOptions = {}): Plugin => {
    const workerSetupPath = join(import.meta.dirname, "worker-setup.js");

    return createGtkxConfigPlugin({
        name: "gtkx:vitest",
        config() {
            return {
                test: {
                    globals: true,
                    setupFiles: [workerSetupPath],
                    provide: { gtkxHeadless: options },
                    testTimeout: 20000,
                    hookTimeout: 20000,
                    pool: "forks",
                    server: {
                        deps: {
                            inline: [...inlineDepsPatterns],
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
