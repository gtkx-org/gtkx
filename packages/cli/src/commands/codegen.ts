import { resolve } from "node:path";
import { defineCommand } from "citty";
import { ensureGenerated, runCodegen } from "../codegen/run-codegen.js";

/**
 * `gtkx codegen` — regenerate TypeScript bindings for the GIR libraries
 * declared in `gtkx.config.ts`.
 *
 * Always regenerates; turbo and the install lifecycle own when it runs. Pass
 * `--clean` to wipe the generated output directories first, or `--if-missing`
 * to regenerate only when a required generated module is absent (used as a
 * build/typecheck prerequisite so the gitignored trees are present for `tsc`).
 */
export const codegen = defineCommand({
    meta: {
        name: "codegen",
        description: "Generate TypeScript bindings for the GIR libraries declared in gtkx.config.ts",
    },
    args: {
        clean: {
            type: "boolean",
            description: "Remove the generated output directories before regenerating",
            default: false,
        },
        "if-missing": {
            type: "boolean",
            description: "Regenerate only when a required generated module is missing",
            default: false,
        },
        cwd: {
            type: "string",
            description: "Project root (default: current working directory)",
        },
    },
    async run({ args }) {
        const cwd = args.cwd ? resolve(args.cwd) : process.cwd();
        const startedAt = Date.now();

        if (args["if-missing"]) {
            const ran = await ensureGenerated(cwd);
            if (ran) {
                console.log("[gtkx] codegen: generated missing bindings");
            }
            return;
        }

        const result = await runCodegen({ cwd, clean: args.clean });

        if (result.configFile) {
            console.log(`[gtkx] codegen: config=${result.configFile}`);
        }
        if (result.libraries) {
            console.log(`[gtkx] codegen: libraries=${result.libraries.join(", ")}`);
        }
        if (result.girPath) {
            console.log(`[gtkx] codegen: girPath=${result.girPath.join(":")}`);
        }

        const total = Date.now() - startedAt;
        console.log(
            `[gtkx] codegen: ${result.namespaces} namespaces, ${result.widgets} widgets in ${result.duration}ms (total ${total}ms)`,
        );
    },
});
