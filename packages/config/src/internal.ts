export type { ResolvedReactCompilerOptions } from "./config.ts";
export {
    isValidApplicationId,
    resolveElementComponents,
    resolveElementProps,
    resolveLazyElements,
    resolveOmittedProps,
} from "./config.ts";
export { type ConfigLoader, createConfigLoader } from "./loader.ts";
