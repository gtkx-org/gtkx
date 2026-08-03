const APPLICATION_ARGS_SEPARATOR = "--";

const splitApplicationArgs = (argv: string[]): { cliArgs: string[]; applicationArgs: string[] } => {
    const separator = argv.indexOf(APPLICATION_ARGS_SEPARATOR);

    if (separator === -1) {
        return { cliArgs: argv, applicationArgs: [] };
    }

    return { cliArgs: argv.slice(0, separator), applicationArgs: argv.slice(separator + 1) };
};

const applicationArgs = (argv: string[] = process.argv.slice(2)): string[] =>
    splitApplicationArgs(argv).applicationArgs;

export { applicationArgs, splitApplicationArgs };
