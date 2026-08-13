import * as p from "@clack/prompts";
import { errorMessage } from "@gtkx/utils";
import { defineCommand } from "citty";
import { OperationCanceledError, ScaffoldAbortedError } from "./errors.js";
import { PACKAGE_MANAGER_FLAG_DESCRIPTION } from "./package-managers.js";
import { scaffold } from "./scaffolder.js";

type CreateCommandArgs = {
    name?: string | undefined;
    "application-id"?: string | undefined;
    "package-manager"?: string | undefined;
    typescript?: boolean | undefined;
    vitest?: boolean | undefined;
    yes?: boolean | undefined;
    "no-interactive"?: boolean | undefined;
    overwrite?: boolean | undefined;
};

const scaffoldCommand = defineCommand({
    meta: {
        name: "create",
        description: "Create a new GTKX application",
    },
    args: {
        name: {
            type: "positional",
            description: "Target directory or project name (e.g. my-app, ., apps/my-app)",
            required: false,
        },
        "application-id": {
            type: "string",
            description: "Application ID (e.g., com.example.myapp)",
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
        "no-interactive": {
            type: "boolean",
            description:
                "Run without prompts, using the default for every option not passed on the command line " +
                "(same as --yes)",
        },
        overwrite: {
            type: "boolean",
            alias: "f",
            description: "Overwrite the contents of a non-empty target directory when running without prompts",
        },
    },
    run: ({ args }) => runCreate(args),
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

const runCreate = async (args: CreateCommandArgs): Promise<void> => {
    const isInteractive = args["no-interactive"] || args.yes ? false : process.stdin.isTTY;

    try {
        await scaffold({
            name: args.name,
            applicationId: args["application-id"],
            packageManager: args["package-manager"],
            isTypescript: args.typescript,
            shouldIncludeTesting: args.vitest,
            isInteractive,
            shouldOverwrite: args.overwrite,
        });
    } catch (error) {
        settleScaffoldFailure(error);
    }
};

export { scaffoldCommand };
