import { output } from "./log.js";

const ERROR_EXIT_CODE = 1;

export type GtkxErrorOptions = ErrorOptions & {
    link?: string;
    action?: string;
};

export class GtkxError extends Error {
    link?: string;
    action?: string;

    constructor(message: string, options?: GtkxErrorOptions) {
        super(message, options);
        this.name = "GtkxError";
        if (options?.link !== undefined) this.link = options.link;
        if (options?.action !== undefined) this.action = options.action;
    }
}

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
