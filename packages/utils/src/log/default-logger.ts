import { Logger } from "./logger.ts";

const logger: Logger = new Logger();

function info(message: string, ...rest: unknown[]): void {
    logger.info(message, ...rest);
}

function warn(message: string, ...rest: unknown[]): void {
    logger.warn(message, ...rest);
}

function error(message: string, ...rest: unknown[]): void {
    logger.error(message, ...rest);
}

function debug(message: string, ...rest: unknown[]): void {
    logger.debug(message, ...rest);
}

export { logger, info, warn, error, debug };
