import { info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { build as buildApp } from "../builder.js";
import { ensureGenerated } from "../codegen/run-codegen.js";
import { entryArg, resolveEntry } from "../internal/entry-arg.js";

const BUILD_MODE = "production";

const build = defineCommand({
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
        const { cwd, entry } = resolveEntry(args);
        info(`Building ${entry}`);
        await ensureGenerated(cwd, { announce: true, mode: BUILD_MODE });

        await buildApp({
            entry,
            assetBase: args["asset-base"],
            vite: {
                root: cwd,
            },
        });

        info("Build complete: dist/bundle.js");
    },
});

export { build };
