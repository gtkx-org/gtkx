import type { ArgsDef, CommandDef } from "citty";
import { logger } from "@gtkx/utils";

const ERROR_EXIT_CODE = 1;

const reportedErrors = (cause: unknown): unknown[] =>
    cause instanceof SuppressedError ? [...reportedErrors(cause.suppressed), ...reportedErrors(cause.error)] : [cause];

const printError = (cause: unknown): never => {
    for (const error of reportedErrors(cause)) {
        logger.error(error instanceof Error ? error.message : String(error));

        if (error instanceof Error && error.stack !== undefined) {
            logger.debug(error.stack);
        }
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
