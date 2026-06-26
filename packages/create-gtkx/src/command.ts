import { defineCommand } from "citty";
import { isKnownPackageManager, PACKAGE_MANAGER_FLAG_DESCRIPTION, type PackageManager } from "./options.js";
import { scaffold } from "./scaffolder.js";

/** Raw, unparsed command-line arguments accepted by the create command. */
export type CreateCommandArgs = {
    name?: string | undefined;
    "application-id"?: string | undefined;
    "package-manager"?: string | undefined;
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

/**
 * Normalize raw create arguments and scaffold the application. Throws on an
 * unknown package manager before any files are written.
 */
export const runCreate = async (args: CreateCommandArgs): Promise<void> => {
    const interactive = args["no-interactive"] ? false : args.yes ? false : process.stdin.isTTY === true;
    await scaffold({
        name: args.name,
        applicationId: args["application-id"],
        packageManager: parsePackageManager(args["package-manager"]),
        includeTesting: args.vitest,
        interactive,
        overwrite: args.overwrite,
    });
};

/**
 * The shared create command: scaffold a new gtkx application. Used as the
 * `gtkx create` subcommand and re-exposed by the standalone `create-gtkx`
 * binary.
 */
export const createCommand = defineCommand({
    meta: {
        name: "create",
        description: "Create a new gtkx application",
    },
    args: {
        name: {
            type: "positional",
            description: "Project name (used as directory name)",
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
