import { defineCommand } from "citty";
import { createApp } from "../create.js";

/**
 * `gtkx create` — interactive project scaffolder.
 *
 * Forwards CLI flags to {@link createApp}, which prompts for any missing
 * options before scaffolding the project.
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
            description: "Package manager (pnpm, npm, yarn)",
        },
        testing: {
            type: "string",
            description: "Testing setup (vitest, none)",
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
            packageManager: args.pm as "pnpm" | "npm" | "yarn" | undefined,
            testing: args.testing as "vitest" | "none" | undefined,
            claudeSkills: args["claude-skills"],
        });
    },
});
