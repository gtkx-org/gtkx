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
        "lock-timeout": {
            type: "string",
            description: "Maximum wait for each generated-store lock in milliseconds (default: 600000)",
        },
        ...configArg,
        ...cwdArg,
    },
    async run({ args }) {
        const lockTimeoutMs = parseLockTimeout(args["lock-timeout"]);
        const cwd = resolveCwd(args);
        const isDisabled = await isCodegenDisabled(cwd, undefined, args.config);
        checkForce(isDisabled, args.force);

        if (isDisabled) {
            await runCodegen({ cwd, configFile: args.config, lockTimeoutMs });
            info("codegen: disabled for this project; reusing an installed binding store");

            return;
        }

        if (!args.force) {
            const isRan = await ensureGenerated(cwd, { configFile: args.config, lockTimeoutMs });
            info(isRan ? "codegen: regenerated stale bindings" : "codegen: bindings up to date");

            return;
        }

        const startedAt = Date.now();
        const result = await runCodegen({ cwd, configFile: args.config, isForced: true, lockTimeoutMs });
        const lines = formatCodegenResult(result, Date.now() - startedAt);

        for (const line of lines) {
            info(line);
        }
    },
});

const parseLockTimeout = (value: string | undefined): number | undefined => {
    if (value === undefined) {
        return undefined;
    }

    const timeout = Number(value);

    if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new Error("--lock-timeout must be a positive finite number of milliseconds");
    }

    return timeout;
};

const checkForce = (isDisabled: boolean, isForced: boolean): void => {
    if (isDisabled && isForced) {
        throw new Error(FORCED_WHILE_DISABLED_MESSAGE);
    }
};

export { codegen };
