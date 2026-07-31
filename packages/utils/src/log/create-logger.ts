import { Logger, type LoggerOptions } from "./logger.ts";

/**
 * Creates a {@link Logger} scoped to the given namespace.
 *
 * @param namespace - Namespace added to the log prefix and matched against debug configuration.
 * @param options - Further logger options, excluding the namespace.
 * @returns A new namespaced logger.
 *
 * @example
 * const log = createLogger("react");
 * log.info("mounted");
 */
function createLogger(namespace: string, options: Omit<LoggerOptions, "namespace"> = {}): Logger {
    return new Logger({ ...options, namespace });
}

export { createLogger };
