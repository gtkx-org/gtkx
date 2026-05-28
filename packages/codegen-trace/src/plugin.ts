/**
 * Vitest plugin that swaps `@gtkx/native` for the recording wrapper and
 * registers the trace setup file.
 *
 * Activation is gated on `GTKX_CODEGEN_TRACE=1`: when the env var is unset
 * the plugin is a no-op so a normal `pnpm test` is unaffected.
 *
 * The `resolveId` hook substitutes the wrapper module for every import of
 * `@gtkx/native` *except* those originating inside this package, so the
 * wrapper itself can import the real binding.
 */

import { join } from "node:path";

import type { Plugin } from "vitest/config";

const ENABLED_ENV = "GTKX_CODEGEN_TRACE";

/**
 * Creates the codegen-trace vitest plugin.
 *
 * @example
 * ```ts
 * import { defineConfig } from "vitest/config";
 * import gtkx from "@gtkx/vitest";
 * import codegenTrace from "@gtkx/codegen-trace/plugin";
 *
 * export default defineConfig({
 *   plugins: [gtkx(), codegenTrace()],
 *   test: {
 *     include: ["tests/**\/*.test.{ts,tsx}"],
 *   },
 * });
 * ```
 */
const codegenTrace = (): Plugin => {
    const enabled = process.env[ENABLED_ENV] === "1";
    const wrapperPath = join(import.meta.dirname, "wrapper.js");
    const setupPath = join(import.meta.dirname, "setup.js");

    return {
        name: "gtkx-codegen-trace",
        enforce: "pre",
        config(config) {
            if (!enabled) return null;
            const existing = config.test?.setupFiles ?? [];
            const list = Array.isArray(existing) ? existing : [existing];
            if (list.includes(setupPath)) return null;
            return { test: { setupFiles: [...list, setupPath] } };
        },
        resolveId(id, importer) {
            if (!enabled) return null;
            if (id !== "@gtkx/native") return null;
            if (importer !== undefined && importer.includes("/packages/codegen-trace/")) return null;
            return wrapperPath;
        },
    };
};

export default codegenTrace;
