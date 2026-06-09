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
 * Two settings keep the GObject identity registries on a single `@gtkx/ffi`
 * instance. `server.deps.inline` transforms every `@gtkx/*` runtime package and
 * the codegen-injected `@gtkx/gi`/`@gtkx/react-gi` so their `@gtkx/ffi` imports
 * resolve to the one source-built runtime; a second copy from `dist` would split
 * the registries. `ssr.resolve.conditions` prefers each package's `source`
 * export so every bare `@gtkx/*` import (including `@gtkx/ffi`, reached only
 * through bare specifiers) loads its TypeScript source under one module
 * identity, which also lets V8 attribute coverage to `src` rather than the
 * unmappable `dist` build.
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
/** The import specifier `@gtkx/react` reads its resolved configuration from. */
const VIRTUAL_CONFIG_ID = "virtual:gtkx-config";

/** Rollup-convention resolved id for {@link VIRTUAL_CONFIG_ID}. */
const RESOLVED_VIRTUAL_CONFIG_ID = `\0${VIRTUAL_CONFIG_ID}`;

const gtkx = (): Plugin => {
    const workerSetupPath = join(import.meta.dirname, "setup.js");

    return {
        name: "gtkx",
        resolveId(id) {
            if (id === VIRTUAL_CONFIG_ID) return RESOLVED_VIRTUAL_CONFIG_ID;
            return undefined;
        },
        load(id) {
            if (id !== RESOLVED_VIRTUAL_CONFIG_ID) return undefined;
            return 'export * from "@gtkx/react-gi/metadata";\nexport const applicationId = undefined;\n';
        },
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
                            inline: [/@gtkx\/(ffi|gi|react|react-gi|testing|css)/, /[/\\]\.gtkx[/\\]/],
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
    };
};

export default gtkx;
