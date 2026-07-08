import type { ResolvedConfig } from "./config.js";

export const GTKX_CONFIG_VIRTUAL_ID = "virtual:gtkx-config";

export const RESOLVED_GTKX_CONFIG_VIRTUAL_ID: string = `\0${GTKX_CONFIG_VIRTUAL_ID}`;

const METADATA_SPECIFIER = "@gtkx/jsx/metadata";

export const renderConfigModule = (config: ResolvedConfig): string =>
    [
        `export * from ${JSON.stringify(METADATA_SPECIFIER)};`,
        `export const applicationId = ${JSON.stringify(config.applicationId)};`,
    ].join("\n");
