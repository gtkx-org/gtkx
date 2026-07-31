import { info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { formatCodegenResult } from "../codegen/report.js";
import { ensureGenerated, isCodegenDisabled, runCodegen, syncSchemaEnv } from "../codegen/run-codegen.js";
import { cwdArg, resolveCwd } from "../internal/entry-arg.js";

const codegen = defineCommand({
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

        if (await isCodegenDisabled(cwd)) {
            await runCodegen({ cwd });
            syncSchemaEnv(cwd);
            info("codegen: disabled for this project; reusing an installed binding store");

            return;
        }

        if (!args.force) {
            const isRan = await ensureGenerated(cwd);
            info(isRan ? "codegen: regenerated stale bindings" : "codegen: bindings up to date");

            return;
        }

        const startedAt = Date.now();
        const result = await runCodegen({ cwd, force: true });
        syncSchemaEnv(cwd);
        const lines = formatCodegenResult(result, Date.now() - startedAt);

        for (const line of lines) {
            info(line);
        }
    },
});

export { codegen };
