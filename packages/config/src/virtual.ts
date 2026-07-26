import type { ResolvedConfig } from "./config.js";

export const GTKX_CONFIG_VIRTUAL_ID = "virtual:gtkx-config";

export const RESOLVED_GTKX_CONFIG_VIRTUAL_ID = `\0${GTKX_CONFIG_VIRTUAL_ID}`;

const METADATA_SPECIFIER = "@gtkx/jsx/metadata";

const lazyElementConfig = (lazyElements: string[]): Record<string, { lazy: true }> =>
    Object.fromEntries(lazyElements.map((type) => [type, { lazy: true }]));

/**
 * The runtime element config is the app's static per-element config (currently its lazy flags) merged
 * with its behaviors module, so a single `elements` map is registered.
 */
export const renderConfigModule = (config: ResolvedConfig): string => {
    const lazyJson = JSON.stringify(lazyElementConfig(config.lazyElements));
    const lines: string[] = [];
    if (config.elements !== null) {
        lines.push("import { mergeElementConfigs } from \"@gtkx/react/config\";");
        lines.push(`import __elementBehaviors from ${JSON.stringify(config.elements)};`);
    }
    lines.push(`export * from ${JSON.stringify(METADATA_SPECIFIER)};`);
    lines.push(`export const applicationId = ${JSON.stringify(config.applicationId)};`);
    lines.push(`export const userEventSignals = ${JSON.stringify(config.userEventSignals)};`,
        config.elements === null
            ? `export const elements = ${lazyJson};`
            : `export const elements = mergeElementConfigs(__elementBehaviors, ${lazyJson});`,
    );
    return lines.join("\n");
};
