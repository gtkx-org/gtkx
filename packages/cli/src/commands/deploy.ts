import { defineCommand } from "citty";
import { KNOWN_NAMES } from "../deploy/registry.js";
import { runDeploy } from "../deploy/run-deploy.js";
import { entryArg, resolveEntry } from "../internal/entry-arg.js";

const deploy = defineCommand({
    meta: {
        name: "deploy",
        description: "Package the application for distribution",
    },
    args: {
        ...entryArg,
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
        const { cwd, entry } = resolveEntry(args);

        await runDeploy({
            entry,
            cwd,
            targets: args.target,
            outDir: args.out,
            shouldPrintManifests: args["print-manifests"] === true,
            shouldSkipBuild: args["skip-build"] === true,
        });
    },
});

export { deploy };
