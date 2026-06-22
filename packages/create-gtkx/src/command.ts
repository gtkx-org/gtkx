import { defineCommand } from "citty";
import { createApp } from "./create.js";
import {
    isKnownPackageManager,
    isTestingOption,
    PACKAGE_MANAGER_FLAG_DESCRIPTION,
    type PackageManager,
    TESTING_FLAG_DESCRIPTION,
    type TestingOption,
} from "./options.js";

/** Raw, unparsed command-line arguments accepted by the create command. */
export type CreateCommandArgs = {
    name?: string | undefined;
    "application-id"?: string | undefined;
    pm?: string | undefined;
    testing?: string | undefined;
};

const parsePackageManager = (value: string | undefined): PackageManager | undefined => {
    if (value === undefined) return undefined;
    if (!isKnownPackageManager(value)) {
        throw new Error(`Unknown package manager "${value}". Expected one of: ${PACKAGE_MANAGER_FLAG_DESCRIPTION}.`);
    }
    return value;
};

const parseTestingOption = (value: string | undefined): TestingOption | undefined => {
    if (value === undefined) return undefined;
    if (!isTestingOption(value)) {
        throw new Error(`Unknown testing setup "${value}". Expected one of: ${TESTING_FLAG_DESCRIPTION}.`);
    }
    return value;
};

/**
 * Normalize raw create arguments and scaffold the application. Throws on an
 * unknown package manager or testing option before any files are written.
 */
export const runCreate = async (args: CreateCommandArgs): Promise<void> => {
    await createApp({
        name: args.name,
        applicationId: args["application-id"],
        packageManager: parsePackageManager(args.pm),
        testing: parseTestingOption(args.testing),
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
        description: "Create a new GTKX application",
    },
    args: {
        name: {
            type: "positional",
            description: "Project name",
            required: false,
        },
        "application-id": {
            type: "string",
            description: "Application ID (e.g., com.example.myapp)",
        },
        pm: {
            type: "string",
            description: PACKAGE_MANAGER_FLAG_DESCRIPTION,
        },
        testing: {
            type: "string",
            description: TESTING_FLAG_DESCRIPTION,
        },
    },
    run: ({ args }) => runCreate(args),
});
