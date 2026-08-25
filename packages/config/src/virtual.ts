import type { ResolvedConfig } from "./config.ts";
import { resourceBasePath } from "./resource-base-path.ts";

const GTKX_CONFIG_VIRTUAL_ID = "virtual:gtkx-config";
const RESOLVED_GTKX_CONFIG_VIRTUAL_ID = `\0${GTKX_CONFIG_VIRTUAL_ID}`;
const METADATA_SPECIFIER = "@gtkx/jsx/metadata";

const lazyElementConfig = (lazyElements: string[]): Record<string, { isLazy: boolean }> =>
    Object.fromEntries(lazyElements.map((type) => [type, { isLazy: true }]));

const renderConfigModule = (config: ResolvedConfig): string => {
    const lazyJson = JSON.stringify(lazyElementConfig(config.lazyElements));

    const behaviorImports =
        config.elements === null
            ? []
            : [
                    "import { mergeElementConfigs } from \"@gtkx/react/config\";",
                    `import __elementBehaviors from ${JSON.stringify(config.elements)};`,
                ];

    return [
        ...behaviorImports,
        `export * from ${JSON.stringify(METADATA_SPECIFIER)};`,
        `export const applicationId = ${JSON.stringify(config.applicationId)};`,
        `export const resourceBasePath = ${JSON.stringify(resourceBasePath(config.applicationId))};`,
        `export const userEventSignals = ${JSON.stringify(config.userEventSignals)};`,
        config.elements === null
            ? `export const elements = ${lazyJson};`
            : `export const elements = mergeElementConfigs(__elementBehaviors, ${lazyJson});`,
    ].join("\n");
};

export { GTKX_CONFIG_VIRTUAL_ID, RESOLVED_GTKX_CONFIG_VIRTUAL_ID, renderConfigModule };
