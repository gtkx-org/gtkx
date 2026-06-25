export {
    dedupeBy,
    enumNamesByValue,
    omit,
    shallowEqual,
    sortedStrings,
    sortedStringsBy,
} from "./collection.js";
export { errorMessage, formatChildProcessError, normalizeError } from "./error.js";
export { exitCodeForSignal, installGracefulShutdown } from "./graceful-shutdown.js";
export { GTKX_ENV_MODULE_HEADER, isValidApplicationId, renderEmptyGtkxEnvModule } from "./project.js";
export { mangleReserved, sourceStringLiteral, toCamelIdentifier } from "./source.js";
export { toCamelCase, toKebabCase, toLowerFirst, toPascalCase, toUpperFirst } from "./string.js";
export type { AnyClass } from "./types.js";
