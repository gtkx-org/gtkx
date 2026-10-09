import type { ArgsDef, CommandDef } from "citty";
import { logger } from "@gtkx/utils";

const ERROR_EXIT_CODE = 1;

const printError = (cause: unknown): never => {
    const message = cause instanceof Error ? cause.message : String(cause);
    logger.error(message);

    if (cause instanceof Error && cause.stack !== undefined) {
        logger.debug(cause.stack);
    }

    process.exit(ERROR_EXIT_CODE);
};

const withErrorBoundary = <T extends ArgsDef>(
    command: CommandDef<T>,
    onError?: (cause: unknown) => never,
): CommandDef<T> => {
    const run = command.run;
    if (run === undefined || onError === undefined) return command;
    return {
        ...command,
        run: async (context): Promise<unknown> => {
            try {
                return await run(context);
            } catch (error) {
                return onError(error);
            }
        },
    };
};

export { printError, withErrorBoundary };
