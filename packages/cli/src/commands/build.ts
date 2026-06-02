import { resolve } from "node:path";
import { defineCommand } from "citty";
import { build as buildApp } from "../builder.js";
import { preflightCodegen } from "../codegen/run-codegen.js";

/**
 * `gtkx build` — bundle the project for production.
 *
 * Runs codegen preflight, then invokes {@link buildApp} with the resolved entry
 * and the optional asset base path. The GResource pipeline reads
 * `applicationId` directly from `gtkx.config.ts`.
 */
export const build = defineCommand({
    meta: {
        name: "build",
        description: "Build application for production",
    },
    args: {
        entry: {
            type: "positional",
            description: "Entry file (default: src/index.tsx)",
            required: false,
        },
        "asset-base": {
            type: "string",
            description: "Asset base path relative to executable directory (e.g., ../share/my-app)",
        },
    },
    async run({ args }) {
        const cwd = process.cwd();
        const entry = resolve(cwd, args.entry ?? "src/index.tsx");
        console.log(`[gtkx] Building ${entry}`);

        await preflightCodegen(cwd);

        await buildApp({
            entry,
            assetBase: args["asset-base"],
            vite: {
                root: cwd,
            },
        });

        console.log("[gtkx] Build complete: dist/bundle.js");
    },
});
