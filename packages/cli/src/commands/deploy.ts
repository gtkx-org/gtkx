import { defineCommand } from "citty";
import { KNOWN_NAMES } from "../deploy/registry.js";
import { runDeploy } from "../deploy/run-deploy.js";
import { configArg, entryArg } from "../internal/entry-arg.js";
import { resolveProject } from "../internal/prepare-project.js";

const DEPLOY_MODE = "production";

const deploy = defineCommand({
    meta: {
        name: "deploy",
        description: "Package the application for distribution",
    },
    args: {
        ...entryArg,
        ...configArg,
        target: {
            type: "string",
            description: `Comma-separated package formats to build (${KNOWN_NAMES})`,
        },
        out: {
            type: "string",
            description: "Output directory relative to the project root (default: build)",
        },
        "print-manifests": {
            type: "boolean",
            description: "Write the generated manifests and metadata, then stop without packaging",
        },
        "skip-build": {
            type: "boolean",
            description: "Package what is already in dist/ instead of rebuilding",
        },
    },
    async run({ args }) {
        const { cwd, entry, configFile } = await resolveProject(args, DEPLOY_MODE);

        await runDeploy({
            entry,
            cwd,
            configFile,
            targets: args.target,
            outDir: args.out,
            shouldPrintManifests: args["print-manifests"] === true,
            shouldSkipBuild: args["skip-build"] === true,
        });
    },
});

export { deploy };
