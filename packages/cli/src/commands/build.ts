import { resolve } from "node:path";
import { defineCommand } from "citty";
import { build } from "../builder.js";
import { loadApplicationId } from "../codegen/config-loader.js";
import { preflightCodegen } from "../codegen/run-codegen.js";

/**
 * `gtkx build` — bundle the project for production.
 *
 * Runs codegen preflight, reads `applicationId` from `gtkx.config.ts`
 * (used for the GResource path prefix and `import.meta.env.GTKX_APP_ID`),
 * then invokes {@link build} with the resolved entry and the optional
 * asset base path.
 */
export const buildCmd = defineCommand({
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
        const applicationId = await loadApplicationId(cwd);

        await build({
            entry,
            applicationId,
            assetBase: args["asset-base"],
            vite: {
                root: cwd,
            },
        });

        console.log("[gtkx] Build complete: dist/bundle.js");
    },
});
