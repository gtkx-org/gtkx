import { join } from "node:path";

import type { Plugin } from "vitest/config";

/**
 * Creates the low-level GTKX Vitest worker plugin.
 *
 * Each worker spawns its own Xvfb instance on a display Xvfb selects, and the
 * `forks` pool is forced so every worker is a fresh process. This is the
 * minimal plugin used directly by the GTKX packages' own test configs; app
 * projects use the combined `gtkx()` from `@gtkx/cli/vitest`, which layers the
 * GResource/asset plugins on top of this one.
 *
 * @returns Vitest plugin configuration
 *
 * @example
 * ```ts
 * // vitest.config.ts
 * import { defineConfig } from "vitest/config";
 * import gtkx from "@gtkx/vitest";
 *
 * export default defineConfig({
 *   plugins: [gtkx()],
 * });
 * ```
 */
const gtkx = (): Plugin => {
    const workerSetupPath = join(import.meta.dirname, "setup.js");

    return {
        name: "gtkx",
        config(config) {
            const setupFiles = config.test?.setupFiles ?? [];

            return {
                test: {
                    setupFiles: [workerSetupPath, ...(Array.isArray(setupFiles) ? setupFiles : [setupFiles])],
                    pool: "forks",
                    server: {
                        // Transform every `@gtkx/*` runtime package (and the
                        // codegen-injected `@gtkx/gi`/`@gtkx/react-jsx`) so their
                        // `@gtkx/ffi` imports all resolve to the one source-built
                        // runtime the tests use. A second copy from `dist` would
                        // split the identity registries.
                        deps: {
                            inline: [/@gtkx\/(ffi|gi|react|react-jsx|testing|css)/, /[/\\]\.gtkx[/\\]/],
                        },
                    },
                },
            };
        },
    };
};

export default gtkx;
