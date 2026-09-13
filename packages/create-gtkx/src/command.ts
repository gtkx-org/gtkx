import * as p from "@clack/prompts";
import { assertSupportedNodeVersion } from "@gtkx/config/internal";
import { camelCase, errorMessage, kebabCase } from "@gtkx/utils";
import { type ArgsDef, defineCommand, type ParsedArgs } from "citty";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { OperationCanceledError, ScaffoldAbortedError } from "./errors.js";
import { PACKAGE_MANAGER_FLAG_DESCRIPTION } from "./package-managers.js";
import { scaffold } from "./scaffolder.js";

const CREATE_ARGS = {
    name: {
        type: "positional",
        description: "Target directory or project name (e.g. my-app, ., apps/my-app)",
        required: false,
    },
    "application-id": {
        type: "string",
        description: "Application ID (e.g., com.example.myapp)",
    },
    "display-name": {
        type: "string",
        description: "Application display name (e.g., My App)",
    },
    "package-manager": {
        type: "string",
        alias: "p",
        description: PACKAGE_MANAGER_FLAG_DESCRIPTION,
    },
    typescript: {
        type: "boolean",
        negativeDescription: "Scaffold the application in JavaScript instead of TypeScript",
        description: "Scaffold the application in TypeScript",
    },
    vitest: {
        type: "boolean",
        description: "Include a Vitest testing setup",
    },
    yes: {
        type: "boolean",
        alias: "y",
        description: "Skip prompts and accept defaults for unspecified options",
    },
    interactive: {
        type: "boolean",
        description: "Prompt for unspecified options when running in a terminal",
        negativeDescription:
            "Run without prompts, using the default for every option not passed on the command line " +
            "(same as --yes)",
    },
    overwrite: {
        type: "boolean",
        alias: "f",
        description: "Replace scaffold files in a non-empty target directory when running without prompts",
    },
    "skip-install": {
        type: "boolean",
        description: "Create the project without installing dependencies",
    },
} as const satisfies ArgsDef;

type OptionToken = Extract<
    ReturnType<typeof parseArgs<{ tokens: true; strict: false }>>["tokens"][number],
    { kind: "option" }
>;

type CreateCommandArgs = Pick<ParsedArgs<typeof CREATE_ARGS>, keyof typeof CREATE_ARGS>;
type CreateOption = Exclude<(typeof CREATE_ARGS)[keyof typeof CREATE_ARGS], { type: "positional" }>;

const strictOption = (definition: CreateOption): ParseArgsOptionsConfig[string] => ({
    type: definition.type,
    ...("alias" in definition && { short: definition.alias }),
});

const createStrictOptions = (): ParseArgsOptionsConfig => {
    const options: ParseArgsOptionsConfig = {};

    for (const [name, definition] of Object.entries(CREATE_ARGS)) {
        if (definition.type === "positional") {
            continue;
        }

        options[name] = strictOption(definition);

        if (camelCase(name) !== name) {
            options[camelCase(name)] = { type: definition.type };
        }
    }

    return options;
};

const STRICT_OPTIONS = createStrictOptions();

const BOOLEAN_OPTIONS = new Set(
    Object.entries(STRICT_OPTIONS).filter(([, option]) => option.type === "boolean").map(([name]) => `--${name}`),
);

const normalizeBooleanArgument = (argument: string): string => {
    const [option, value, ...rest] = argument.split("=");

    if (option === undefined || rest.length > 0 || !BOOLEAN_OPTIONS.has(option)) {
        return argument;
    }

    if (value === "true") {
        return option;
    }

    return value === "false" ? `--no-${option.slice(2)}` : argument;
};

const canonicalOption = (token: OptionToken): [string, string | boolean] =>
    [kebabCase(token.name), token.value ?? !token.rawName.startsWith("--no-")];

const parseCreateArguments = (rawArgs: string[]): CreateCommandArgs => {
    const { tokens, positionals } = parseArgs({
        args: rawArgs.map((argument) =>
            normalizeBooleanArgument(argument === "--noInteractive" ? "--no-interactive" : argument)),
        options: STRICT_OPTIONS,
        allowPositionals: true,
        allowNegative: true,
        strict: true,
        tokens: true,
    });

    if (positionals.length > 1) {
        throw new TypeError("Expected one project directory");
    }

    return {
        ...Object.fromEntries(tokens.filter((token) => token.kind === "option").map((token) => canonicalOption(token))),
        name: positionals[0],
    } as CreateCommandArgs;
};

const scaffoldCommand = defineCommand({
    meta: {
        name: "create",
        description: "Create a new Adwaita-first GNOME application with GTKX",
    },
    args: CREATE_ARGS,
    run: ({ rawArgs }) => runCreate(rawArgs),
});

const settleScaffoldFailure = (error: unknown): void => {
    if (error instanceof OperationCanceledError) {
        return;
    }

    if (!(error instanceof ScaffoldAbortedError)) {
        p.log.error(errorMessage(error));
    }

    process.exitCode = 1;
};

const runCreate = async (rawArgs: string[]): Promise<void> => {
    try {
        const args = parseCreateArguments(rawArgs);
        const isInteractive = args.interactive === false || args.yes ? false : process.stdin.isTTY;
        assertSupportedNodeVersion();
        await scaffold({
            name: args.name,
            applicationId: args["application-id"],
            displayName: args["display-name"],
            packageManager: args["package-manager"],
            isTypescript: args.typescript,
            shouldIncludeTesting: args.vitest,
            isInteractive,
            shouldOverwrite: args.overwrite,
            shouldInstallDependencies: args["skip-install"] !== true,
        });
    } catch (error) {
        settleScaffoldFailure(error);
    }
};

export { scaffoldCommand };
