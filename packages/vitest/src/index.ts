import { join } from "node:path";

import { createGtkxConfigPlugin } from "@gtkx/config/plugin";
import type { Plugin } from "vitest/config";
import { type HeadlessOptions, STATIC_HEADLESS_ENV } from "./headless-display.js";

export type GtkxPluginOptions = Partial<HeadlessOptions>;

type SourceResolveConfig = {
    ssr: { resolve: { conditions: string[] } };
    test: { server: { deps: { inline: (string | RegExp)[] } } };
};

export const sourceResolveConfig: SourceResolveConfig = {
    ssr: {
        resolve: {
            conditions: ["source", "module", "node", "development|production"],
        },
    },
    test: {
        server: {
            deps: {
                inline: [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/],
            },
        },
    },
};

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
                    env: STATIC_HEADLESS_ENV,
                    server: sourceResolveConfig.test.server,
                },
                ssr: sourceResolveConfig.ssr,
            };
        },
    });
};

export default gtkx;
