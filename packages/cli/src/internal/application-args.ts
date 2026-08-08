const APPLICATION_ARGS_SEPARATOR = "--";

const splitApplicationArgs = (argv: string[]): { cliArgs: string[]; applicationArgs: string[] } => {
    const separator = argv.indexOf(APPLICATION_ARGS_SEPARATOR);

    if (separator === -1) {
        return { cliArgs: argv, applicationArgs: [] };
    }

    return { cliArgs: argv.slice(0, separator), applicationArgs: argv.slice(separator + 1) };
};

export { splitApplicationArgs };
