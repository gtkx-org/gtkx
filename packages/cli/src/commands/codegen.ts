import { resolve } from "node:path";
import { defineCommand } from "citty";
import { ensureGenerated, runCodegen, syncSchemaEnv } from "../codegen/run-codegen.js";

/**
 * `gtkx codegen` — regenerate the TypeScript bindings for the GIR libraries
 * declared in `gtkx.config.ts`.
 *
 * Default: regenerate only when the store is missing or its fingerprint is stale
 * (a changed library set, GIR runtime, or `@gtkx/codegen` version) — the
 * conditional path the `@gtkx/cli#codegen` turbo task and the `gtkx dev`/`gtkx
 * build` preflight use. Pass `--force` to wipe the store and regenerate
 * unconditionally: the last-ditch recovery for a corrupted store.
 */
export const codegen = defineCommand({
    meta: {
        name: "codegen",
        description: "Generate TypeScript bindings for the GIR libraries declared in gtkx.config.ts",
    },
    args: {
        force: {
            type: "boolean",
            description: "Wipe the generated store and regenerate unconditionally (recover a corrupted store)",
            default: false,
        },
        cwd: {
            type: "string",
            description: "Project root (default: current working directory)",
        },
    },
    async run({ args }) {
        const cwd = args.cwd ? resolve(args.cwd) : process.cwd();

        if (!args.force) {
            const ran = await ensureGenerated(cwd);
            console.log(ran ? "[gtkx] codegen: regenerated stale bindings" : "[gtkx] codegen: bindings up to date");
            return;
        }

        const startedAt = Date.now();
        const result = await runCodegen({ cwd, force: true });
        syncSchemaEnv(cwd);

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
