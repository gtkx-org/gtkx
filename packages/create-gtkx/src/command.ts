import { defineCommand } from "citty";
import { isKnownPackageManager, PACKAGE_MANAGER_FLAG_DESCRIPTION, type PackageManager } from "./package-managers.js";
import { scaffold } from "./scaffolder.js";

export type CreateCommandArgs = {
    name?: string | undefined;
    "application-id"?: string | undefined;
    "package-manager"?: string | undefined;
    typescript?: boolean | undefined;
    vitest?: boolean | undefined;
    yes?: boolean | undefined;
    "no-interactive"?: boolean | undefined;
    overwrite?: boolean | undefined;
};

const parsePackageManager = (value: string | undefined): PackageManager | undefined => {
    if (value === undefined) return undefined;
    if (!isKnownPackageManager(value)) {
        throw new Error(`Unknown package manager "${value}". Expected one of: ${PACKAGE_MANAGER_FLAG_DESCRIPTION}.`);
    }
    return value;
};

export const runCreate = async (args: CreateCommandArgs): Promise<void> => {
    const interactive = args["no-interactive"] ? false : args.yes ? false : process.stdin.isTTY === true;
    await scaffold({
        name: args.name,
        applicationId: args["application-id"],
        packageManager: parsePackageManager(args["package-manager"]),
        typescript: args.typescript,
        includeTesting: args.vitest,
        interactive,
        overwrite: args.overwrite,
    });
};

/**
 * Citty command definition for the CLI `create` subcommand. It declares the
 * scaffolder's arguments (target name, application ID, package manager,
 * TypeScript and Vitest toggles, prompt behavior, and overwrite) and runs the
 * scaffolder to generate a new gtkx application.
 */
export const createCommand = defineCommand({
    meta: {
        name: "create",
        description: "Create a new gtkx application",
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
            alias: "pm",
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
            description: "Run without prompts, failing instead of asking",
        },
        overwrite: {
            type: "boolean",
            alias: "force",
            description: "Overwrite the target directory if it already exists",
        },
    },
    run: ({ args }) => runCreate(args),
});
