import { info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { formatCodegenResult } from "../codegen/report.js";
import { ensureGenerated, isCodegenDisabled, runCodegen } from "../codegen/run-codegen.js";
import { configArg, cwdArg, resolveCwd } from "../internal/entry-arg.js";

const FORCED_WHILE_DISABLED_MESSAGE =
    "codegen is disabled for this project, so --force has no store to regenerate here. " +
    "Remove `codegen: false` from gtkx.config.ts, or run `gtkx codegen --force` where the installed " +
    "binding store is generated.";

const codegen = defineCommand({
    meta: {
        name: "codegen",
        description: "Generate project bindings, translation catalogs, and TypeScript declarations",
    },
    args: {
        force: {
            type: "boolean",
            description: "Wipe the generated store and regenerate unconditionally (recover a corrupted store)",
            default: false,
        },
        ...configArg,
        ...cwdArg,
    },
    async run({ args }) {
        const cwd = resolveCwd(args);
        const isDisabled = await isCodegenDisabled(cwd, undefined, args.config);
        checkForce(isDisabled, args.force);

        if (isDisabled) {
            await runCodegen({ cwd, configFile: args.config });
            info("codegen: disabled for this project; reusing an installed binding store");

            return;
        }

        if (!args.force) {
            const isRan = await ensureGenerated(cwd, { configFile: args.config });
            info(isRan ? "codegen: regenerated stale bindings" : "codegen: bindings up to date");

            return;
        }

        const startedAt = Date.now();
        const result = await runCodegen({ cwd, configFile: args.config, isForced: true });
        const lines = formatCodegenResult(result, Date.now() - startedAt);

        for (const line of lines) {
            info(line);
        }
    },
});

const checkForce = (isDisabled: boolean, isForced: boolean): void => {
    if (isDisabled && isForced) {
        throw new Error(FORCED_WHILE_DISABLED_MESSAGE);
    }
};

export { codegen };
