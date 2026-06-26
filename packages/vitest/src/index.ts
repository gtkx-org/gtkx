import { join } from "node:path";

import { createGtkxConfigPlugin } from "@gtkx/config";
import type { Plugin } from "vitest/config";
import type { HeadlessOptions } from "./headless-display.js";

export type GtkxPluginOptions = Partial<HeadlessOptions>;

const inlineDepsPatterns: RegExp[] = [/@gtkx\/(config|ffi|gi|react|jsx|testing|css)/, /[/\\]\.gtkx[/\\]/];

const gtkx = (options: GtkxPluginOptions = {}): Plugin => {
    const environmentPath = join(import.meta.dirname, "environment.js");

    return createGtkxConfigPlugin({
        name: "gtkx:vitest",
        config() {
            return {
                test: {
                    environment: environmentPath,
                    environmentOptions: options,
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
