export type { AnyClass } from "./class.js";
export {
    dedupeBy,
    enumNamesByValue,
    omit,
    shallowEqual,
    sortedStrings,
    sortedStringsBy,
} from "./collection.js";
export { errorMessage, formatChildProcessError, normalizeError } from "./error.js";
export {
    exitCodeForSignal,
    type GracefulShutdownHandle,
    type GracefulShutdownOptions,
    installGracefulShutdown,
} from "./graceful-shutdown.js";
export { GtkxEnvModuleHeader, isValidApplicationId, renderEmptyGtkxEnvModule } from "./project.js";
export { mangleReserved, sourceStringLiteral, toCamelIdentifier } from "./source.js";
export { toCamelCase, toKebabCase, toLowerFirst, toPascalCase, toUpperFirst } from "./string.js";
