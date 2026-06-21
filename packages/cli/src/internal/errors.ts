/**
 * Error taxonomy and the command-execution boundary for the CLI.
 *
 * Expected, user-facing failures are expressed as {@link GtkxError} so the
 * boundary can render them as a single-line message with a defined exit code,
 * while unexpected errors surface their stack only under debug output.
 */

import { output } from "./log.js";

const EXPECTED_ERROR_EXIT_CODE = 1;

const UNEXPECTED_ERROR_EXIT_CODE = 1;

/**
 * An expected, user-facing failure carrying a clean message.
 *
 * The command boundary renders these as a single line through the output sink
 * instead of dumping a stack.
 */
export class GtkxError extends Error {
    /**
     * @param message - The user-facing, single-line failure message.
     * @param options - Standard error options, e.g. an underlying `cause`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "GtkxError";
    }
}

/**
 * Runs a command body inside the error-classifying boundary.
 *
 * Known {@link GtkxError} failures print a single-line message and exit with
 * {@link EXPECTED_ERROR_EXIT_CODE}; any other error prints its message, emits
 * its stack only under debug output, and exits with
 * {@link UNEXPECTED_ERROR_EXIT_CODE}.
 *
 * @param fn - The command body to execute.
 */
export const runCommand = async (fn: () => Promise<void>): Promise<void> => {
    try {
        await fn();
    } catch (cause) {
        if (cause instanceof GtkxError) {
            output.error(cause.message);
            process.exit(EXPECTED_ERROR_EXIT_CODE);
        }
        const message = cause instanceof Error ? cause.message : String(cause);
        output.error(message);
        if (cause instanceof Error && cause.stack !== undefined) {
            output.debug(cause.stack);
        }
        process.exit(UNEXPECTED_ERROR_EXIT_CODE);
    }
};
