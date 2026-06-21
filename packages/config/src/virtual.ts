import type { ResolvedGtkxConfig } from "./config.js";

/**
 * Public specifier the Vite plugin resolves to the emitted gtkx config module.
 */
export const GTKX_CONFIG_VIRTUAL_ID = "virtual:gtkx-config";

/**
 * Internal rollup id for the resolved gtkx config module, prefixed with the
 * virtual-module sentinel so other plugins leave it untouched.
 */
export const RESOLVED_GTKX_CONFIG_VIRTUAL_ID: string = `\0${GTKX_CONFIG_VIRTUAL_ID}`;

const METADATA_SPECIFIER = "@gtkx/jsx/metadata";

/**
 * The config-derived values exported into `virtual:gtkx-config`.
 *
 * This is the explicit allowlist of {@link ResolvedGtkxConfig} fields that cross
 * into the emitted module, decoupling the serialized surface from the full
 * resolved-config shape and giving the ambient declaration in `env.d.ts` a
 * compile-time anchor.
 */
export type SerializedGtkxConfig = Pick<
    ResolvedGtkxConfig,
    | "libraries"
    | "girPath"
    | "applicationId"
    | "containerProps"
    | "arrayProps"
    | "objectProps"
    | "virtualProps"
    | "elementMap"
    | "reactCompiler"
>;

const serializeConfigValue = (value: unknown): string => (value === undefined ? "undefined" : JSON.stringify(value));

/**
 * Projects a resolved config onto the explicit set of fields exported into
 * `virtual:gtkx-config`.
 *
 * @param config - the resolved gtkx config
 * @returns an object containing only the serialized config-derived fields
 */
export const serializeGtkxConfig = (config: ResolvedGtkxConfig): SerializedGtkxConfig => ({
    libraries: config.libraries,
    girPath: config.girPath,
    applicationId: config.applicationId,
    containerProps: config.containerProps,
    arrayProps: config.arrayProps,
    objectProps: config.objectProps,
    virtualProps: config.virtualProps,
    elementMap: config.elementMap,
    reactCompiler: config.reactCompiler,
});

/**
 * Renders the source of the `virtual:gtkx-config` module for a resolved config.
 *
 * The module re-exports the codegen-emitted metadata tables and declares one
 * named constant per {@link SerializedGtkxConfig} field, with an unset
 * `applicationId` emitted as `undefined`.
 *
 * @param config - the resolved gtkx config to serialize into the module
 * @returns the emitted module source
 */
export const renderGtkxConfigModule = (config: ResolvedGtkxConfig): string =>
    [
        `export * from ${JSON.stringify(METADATA_SPECIFIER)};`,
        ...Object.entries(serializeGtkxConfig(config)).map(
            ([key, value]) => `export const ${key} = ${serializeConfigValue(value)};`,
        ),
    ].join("\n");
