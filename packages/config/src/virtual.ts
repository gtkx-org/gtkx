import type { ResolvedGtkxConfig } from "./config.js";

export const GTKX_CONFIG_VIRTUAL_ID = "virtual:gtkx-config";

export const RESOLVED_GTKX_CONFIG_VIRTUAL_ID: string = `\0${GTKX_CONFIG_VIRTUAL_ID}`;

const METADATA_SPECIFIER = "@gtkx/jsx/metadata";

const serializeConfigValue = (value: unknown): string => (value === undefined ? "undefined" : JSON.stringify(value));

export const renderGtkxConfigModule = (config: ResolvedGtkxConfig): string =>
    [
        `export * from ${JSON.stringify(METADATA_SPECIFIER)};`,
        ...Object.entries(config).map(([key, value]) => `export const ${key} = ${serializeConfigValue(value)};`),
    ].join("\n");
