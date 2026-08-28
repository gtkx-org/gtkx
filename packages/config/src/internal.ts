export type { McpSettings, ResolvedFuture, ResolvedReactCompilerOptions } from "./config.ts";
export {
    APPLICATION_ID_MAX_LENGTH,
    isAgentReferenceEnabled,
    isAgentRulesEnabled,
    isValidApplicationId,
    resolveElementComponents,
    resolveElementProps,
    resolveFuture,
    resolveLazyElements,
    resolveMcpSettings,
    resolveOmittedProps,
    unknownFutureKeys,
} from "./config.ts";
export { createConfigLoader } from "./loader.ts";
export { resourceBasePath } from "./resource-base-path.ts";
