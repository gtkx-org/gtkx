import { defineCommand } from "citty";
import { formatCodegenResult } from "../codegen/report.js";
import { ensureGenerated, runCodegen, syncSchemaEnv } from "../codegen/run-codegen.js";
import { cwdArg, resolveCwd } from "../internal/entry-arg.js";
import { info } from "../internal/log.js";

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
        ...cwdArg,
    },
    async run({ args }) {
        const cwd = resolveCwd(args);

        if (!args.force) {
            const ran = await ensureGenerated(cwd);
            info(ran ? "codegen: regenerated stale bindings" : "codegen: bindings up to date");
            return;
        }

        const startedAt = Date.now();
        const result = await runCodegen({ cwd, force: true });
        syncSchemaEnv(cwd);

        for (const line of formatCodegenResult(result, Date.now() - startedAt)) {
            info(line);
        }
    },
});
