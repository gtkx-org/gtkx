import type { ResolvedGtkxConfig } from "./config.js";

/**
 * The import specifier `@gtkx/react` reads its metadata tables from and
 * `@gtkx/config/runtime` re-exports verbatim. Served by the gtkx Vite plugins
 * during `gtkx dev`/`gtkx build` and by the `@gtkx/vitest` plugin under tests;
 * `gtkx build` inlines the resolved module into the production bundle.
 */
export const GTKX_CONFIG_VIRTUAL_ID = "virtual:gtkx-config";

/**
 * Rollup-convention resolved id for {@link GTKX_CONFIG_VIRTUAL_ID} (the `\0`
 * prefix marks it virtual).
 */
export const RESOLVED_GTKX_CONFIG_VIRTUAL_ID = `\0${GTKX_CONFIG_VIRTUAL_ID}`;

const METADATA_SPECIFIER = "@gtkx/jsx/metadata";

const serializeConfigValue = (value: unknown): string => (value === undefined ? "undefined" : JSON.stringify(value));

/**
 * Renders the `virtual:gtkx-config` module source: the codegen-derived
 * metadata tables re-exported from the generated bindings package, plus each
 * field of the project's resolved `gtkx.config.ts` as a named constant, so
 * `@gtkx/config/runtime` can re-export the module verbatim.
 *
 * Every server of the virtual module (the gtkx Vite plugins, the
 * `@gtkx/vitest` plugin) renders through this helper so the module shape
 * stays identical across dev, build, and test pipelines.
 *
 * @param config - The project's resolved configuration
 * @returns The JavaScript module source to serve
 */
export const renderGtkxConfigModule = (config: ResolvedGtkxConfig): string =>
    [
        `export * from ${JSON.stringify(METADATA_SPECIFIER)};`,
        ...Object.entries(config).map(([key, value]) => `export const ${key} = ${serializeConfigValue(value)};`),
    ].join("\n");
