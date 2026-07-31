import { Logger, type LoggerOptions } from "./logger.ts";

function createLogger(namespace: string, options: Omit<LoggerOptions, "namespace"> = {}): Logger {
    return new Logger({ ...options, namespace });
}

export { createLogger };
