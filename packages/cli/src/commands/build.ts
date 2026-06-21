import { defineCommand } from "citty";
import { build as buildApp } from "../builder.js";
import { preflightCodegen } from "../codegen/run-codegen.js";
import { runCommand } from "../internal/errors.js";
import { info } from "../internal/log.js";
import { entryArg, resolveEntry } from "./entry.js";

export const build = defineCommand({
    meta: {
        name: "build",
        description: "Build application for production",
    },
    args: {
        ...entryArg,
        "asset-base": {
            type: "string",
            description: "Asset base path relative to executable directory (e.g., ../share/my-app)",
        },
    },
    async run({ args }) {
        await runCommand(async () => {
            const { cwd, entry } = resolveEntry(args);
            info(`Building ${entry}`);

            await preflightCodegen(cwd);

            await buildApp({
                entry,
                assetBase: args["asset-base"],
                vite: {
                    root: cwd,
                },
            });

            info("Build complete: dist/bundle.js");
        });
    },
});
