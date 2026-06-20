import { defineCommand } from "citty";
import {
    isKnownPackageManager,
    isTestingOption,
    PACKAGE_MANAGER_FLAG_DESCRIPTION,
    type PackageManager,
    TESTING_FLAG_DESCRIPTION,
    type TestingOption,
} from "../create/options.js";
import { createApp } from "../create.js";

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
 * `gtkx create` — interactive project scaffolder.
 *
 * Forwards CLI flags to {@link createApp}, which prompts for any missing
 * options before scaffolding the project. The `--pm`/`--testing` flags are
 * validated against the supported sets before scaffolding begins.
 */
export const create = defineCommand({
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
        "claude-skills": {
            type: "boolean",
            description: "Include Claude Code skills for AI assistance",
        },
    },
    async run({ args }) {
        await createApp({
            name: args.name,
            applicationId: args["application-id"],
            packageManager: parsePackageManager(args.pm),
            testing: parseTestingOption(args.testing),
            claudeSkills: args["claude-skills"],
        });
    },
});
