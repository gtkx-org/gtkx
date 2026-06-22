import type { ResolvedGtkxConfig } from "./config.js";

export const GTKX_CONFIG_VIRTUAL_ID = "virtual:gtkx-config";

export const RESOLVED_GTKX_CONFIG_VIRTUAL_ID: string = `\0${GTKX_CONFIG_VIRTUAL_ID}`;

const METADATA_SPECIFIER = "@gtkx/jsx/metadata";

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

export const renderGtkxConfigModule = (config: ResolvedGtkxConfig): string =>
    [
        `export * from ${JSON.stringify(METADATA_SPECIFIER)};`,
        ...Object.entries(serializeGtkxConfig(config)).map(
            ([key, value]) => `export const ${key} = ${serializeConfigValue(value)};`,
        ),
    ].join("\n");
