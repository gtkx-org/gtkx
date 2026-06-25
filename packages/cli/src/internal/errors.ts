import { output } from "./log.js";

const ERROR_EXIT_CODE = 1;

export class GtkxError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "GtkxError";
    }
}

export const runCommand = async (fn: () => Promise<void>): Promise<void> => {
    try {
        await fn();
    } catch (cause) {
        if (cause instanceof GtkxError) {
            output.error(cause.message);
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
