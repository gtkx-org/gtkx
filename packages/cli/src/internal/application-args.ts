import type { ArgsDef, CommandDef } from "citty";

const APPLICATION_ARGS_SEPARATOR = "--";

const splitApplicationArgs = (argv: string[]): { cliArgs: string[]; applicationArgs: string[] } => {
    const separator = argv.indexOf(APPLICATION_ARGS_SEPARATOR);

    if (separator === -1) {
        return { cliArgs: argv, applicationArgs: [] };
    }

    return { cliArgs: argv.slice(0, separator), applicationArgs: argv.slice(separator + 1) };
};

const withoutApplicationArgs = <T extends ArgsDef>(
    name: string,
    command: CommandDef<T>,
    applicationArgs: string[] | undefined,
): CommandDef<T> => {
    const run = command.run;

    if (run === undefined) {
        return command;
    }

    return {
        ...command,
        run: async (context): Promise<unknown> => {
            const ignored = (applicationArgs ?? splitApplicationArgs(context.rawArgs).applicationArgs).join(" ");

            if (ignored !== "") {
                throw new Error(
                    `gtkx ${name} takes no application arguments after "--", so it would ignore "${ignored}". ` +
                        `pnpm and Yarn pass "--" on to package scripts; leave it out there, as in "pnpm run ${name} ${ignored}".`,
                );
            }

            return await run(context);
        },
    };
};

export { splitApplicationArgs, withoutApplicationArgs };
