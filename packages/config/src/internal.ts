export type { McpSettings, ResolvedReactCompilerOptions } from "./config.ts";
export {
    APPLICATION_ID_MAX_LENGTH,
    isAgentReferenceEnabled,
    isAgentRulesEnabled,
    isValidApplicationId,
    resolveElementComponents,
    resolveElementProps,
    resolveLazyElements,
    resolveMcpSettings,
    resolveOmittedProps,
} from "./config.ts";
export { createConfigLoader } from "./loader.ts";
export { resourceBasePath } from "./resource-base-path.ts";
