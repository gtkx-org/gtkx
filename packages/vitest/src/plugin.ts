import { join } from "node:path";

import type { Plugin } from "vitest/config";

/**
 * Creates the GTKX Vitest plugin for running GTK tests.
 *
 * Each worker spawns its own Xvfb instance on a PID-based display number.
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
                },
            };
        },
    };
};

export default gtkx;
