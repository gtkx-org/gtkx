import { join } from "node:path";

import {
    createGtkxConfigLoader,
    GTKX_CONFIG_VIRTUAL_ID,
    RESOLVED_GTKX_CONFIG_VIRTUAL_ID,
    renderGtkxConfigModule,
} from "@gtkx/config";
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
 * The plugin serves `virtual:gtkx-config` from the project's own
 * `gtkx.config.ts`, loaded lazily on the module's first request so the
 * combined `gtkx()` pipeline — whose `gtkx:config` plugin resolves the module
 * first — never triggers a second load. A project without a config file
 * receives the empty resolved config.
 *
 * Two settings keep the GObject identity registries on a single `@gtkx/ffi`
 * instance. `server.deps.inline` transforms every `@gtkx/*` runtime package and
 * the codegen-injected `@gtkx/gi`/`@gtkx/jsx` so their `@gtkx/ffi` imports
 * resolve to the one source-built runtime; a second copy from `dist` would split
 * the registries. `@gtkx/config` is inlined too, so its `runtime` entry's
 * `virtual:gtkx-config` import resolves through this plugin instead of Node. `ssr.resolve.conditions` prefers each package's `source`
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
const gtkx = (): Plugin => {
    const workerSetupPath = join(import.meta.dirname, "setup.js");
    const loadConfig = createGtkxConfigLoader();
    let root = process.cwd();

    return {
        name: "gtkx",
        resolveId(id) {
            if (id === GTKX_CONFIG_VIRTUAL_ID) return RESOLVED_GTKX_CONFIG_VIRTUAL_ID;
            return undefined;
        },
        async load(id) {
            if (id !== RESOLVED_GTKX_CONFIG_VIRTUAL_ID) return undefined;
            return renderGtkxConfigModule(await loadConfig(root));
        },
        config(config) {
            root = config.root ?? process.cwd();
            const setupFiles = config.test?.setupFiles ?? [];

            return {
                test: {
                    setupFiles: [workerSetupPath, ...(Array.isArray(setupFiles) ? setupFiles : [setupFiles])],
                    testTimeout: 20000,
                    hookTimeout: 20000,
                    pool: "forks",
                    server: {
                        deps: {
                            inline: [/@gtkx\/(config|ffi|gi|react|jsx|testing|css)/, /[/\\]\.gtkx[/\\]/],
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
