const PREFIX = "[gtkx]";

/**
 * Writes an informational line to stdout under the shared `[gtkx]` prefix.
 *
 * @param message - The line to print after the prefix.
 * @param rest - Extra values forwarded to `console.log` unchanged.
 */
export const info = (message: string, ...rest: unknown[]): void => console.log(`${PREFIX} ${message}`, ...rest);

/**
 * Writes a warning line to stderr under the shared `[gtkx]` prefix.
 *
 * @param message - The line to print after the prefix.
 * @param rest - Extra values forwarded to `console.warn` unchanged.
 */
export const warn = (message: string, ...rest: unknown[]): void => console.warn(`${PREFIX} ${message}`, ...rest);

/**
 * Writes an error line to stderr under the shared `[gtkx]` prefix.
 *
 * @param message - The line to print after the prefix.
 * @param rest - Extra values forwarded to `console.error` unchanged.
 */
export const error = (message: string, ...rest: unknown[]): void => console.error(`${PREFIX} ${message}`, ...rest);

/**
 * Alias of {@link info} for collaborators wired through a single `log(message)`
 * port.
 */
export const log = info;
