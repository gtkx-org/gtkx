import { Logger } from "./logger.js";

/**
 * The default namespace-less {@link Logger} backing the module-level {@link info}, {@link warn},
 * {@link error}, and {@link debug} functions.
 */
const logger: Logger = new Logger();

/**
 * Writes an informational line through the shared {@link logger}.
 *
 * @param message - The message text.
 * @param rest - Extra values appended after the message, formatted for display.
 */
function info(message: string, ...rest: unknown[]): void {
    logger.info(message, ...rest);
}

/**
 * Writes a warning line through the shared {@link logger}.
 *
 * @param message - The message text.
 * @param rest - Extra values appended after the message, formatted for display.
 */
function warn(message: string, ...rest: unknown[]): void {
    logger.warn(message, ...rest);
}

/**
 * Writes an error line through the shared {@link logger}.
 *
 * @param message - The message text.
 * @param rest - Extra values appended after the message, formatted for display.
 */
function error(message: string, ...rest: unknown[]): void {
    logger.error(message, ...rest);
}

/**
 * Writes a debug line through the shared {@link logger} when debug output is enabled.
 *
 * @param message - The message text.
 * @param rest - Extra values appended after the message, formatted for display.
 */
function debug(message: string, ...rest: unknown[]): void {
    logger.debug(message, ...rest);
}

export { logger, info, warn, error, debug };
