import { logger } from "@gtkx/utils";
import type { ArgsDef, CommandDef } from "citty";

const ERROR_EXIT_CODE = 1;

export class GtkxError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "GtkxError";
    }
}

export const printError = (cause: unknown): never => {
    if (cause instanceof GtkxError) {
        logger.error(cause.message);
        process.exit(ERROR_EXIT_CODE);
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    logger.error(message);
    if (cause instanceof Error && cause.stack !== undefined) {
        logger.debug(cause.stack);
    }
    process.exit(ERROR_EXIT_CODE);
};

export const withErrorBoundary = <T extends ArgsDef>(command: CommandDef<T>): CommandDef<T> => {
    const run = command.run;
    if (run === undefined) return command;
    return {
        ...command,
        run: async (context) => {
            try {
                return await run(context);
            } catch (cause) {
                printError(cause);
            }
        },
    };
};
