/**
 * Error taxonomy and the command-execution boundary for the CLI.
 *
 * Expected, user-facing failures are expressed as {@link GtkxError} so the
 * boundary can render them as a single-line message — optionally followed by a
 * documentation link — while unexpected errors surface their stack only under
 * debug output. Both categories exit with {@link ERROR_EXIT_CODE}.
 */

import { output } from "./log.js";

const ERROR_EXIT_CODE = 1;

/**
 * Options accepted by {@link GtkxError}: the standard {@link ErrorOptions} plus
 * an optional documentation `link` and the `action` label introducing it.
 */
export type GtkxErrorOptions = ErrorOptions & {
    /** A documentation URL (e.g. on gtkx.dev) that helps resolve the failure. */
    link?: string;
    /** A short label introducing {@link GtkxErrorOptions.link}, e.g. "See". */
    action?: string;
};

/**
 * An expected, user-facing failure carrying a clean message.
 *
 * The command boundary renders these as a single line through the output sink
 * instead of dumping a stack, optionally followed by a documentation link.
 */
export class GtkxError extends Error {
    /** A documentation URL that helps the user resolve the failure. */
    link?: string;
    /** A short label introducing {@link GtkxError.link}, e.g. "See". */
    action?: string;

    /**
     * @param message - The user-facing, single-line failure message.
     * @param options - Standard error options plus an optional docs `link`/`action`.
     */
    constructor(message: string, options?: GtkxErrorOptions) {
        super(message, options);
        this.name = "GtkxError";
        if (options?.link !== undefined) this.link = options.link;
        if (options?.action !== undefined) this.action = options.action;
    }
}

/**
 * Runs a command body inside the error-classifying boundary.
 *
 * Known {@link GtkxError} failures print a single-line message (plus their docs
 * link when present); any other error prints its message and emits its stack
 * only under debug output. Both exit with {@link ERROR_EXIT_CODE}.
 *
 * @param fn - The command body to execute.
 */
export const runCommand = async (fn: () => Promise<void>): Promise<void> => {
    try {
        await fn();
    } catch (cause) {
        if (cause instanceof GtkxError) {
            output.error(cause.message);
            if (cause.link !== undefined) {
                output.error(`${cause.action ?? "See"}: ${cause.link}`);
            }
            process.exit(ERROR_EXIT_CODE);
        }
        const message = cause instanceof Error ? cause.message : String(cause);
        output.error(message);
        if (cause instanceof Error && cause.stack !== undefined) {
            output.debug(cause.stack);
        }
        process.exit(ERROR_EXIT_CODE);
    }
};
