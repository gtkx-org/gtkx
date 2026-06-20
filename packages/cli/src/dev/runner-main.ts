import { resolve } from "node:path";
import { resolveDataDir } from "@gtkx/config";
import { createDevRunner } from "./runner.js";
import { prepareDevSchemaEnv } from "./schema-env.js";

const ENTRY_ARG_INDEX = 2;

export const main = async (): Promise<void> => {
    const cwd = process.cwd();
    const entryArg = process.argv[ENTRY_ARG_INDEX];

    if (!entryArg) {
        console.error("[gtkx-dev-runner] Missing entry argument");
        process.exit(1);
    }

    prepareDevSchemaEnv(cwd, resolveDataDir(cwd));

    const entryPath = resolve(cwd, entryArg);
    const { defaultDevRunnerDeps } = await import("./runner-deps.js");
    const runner = createDevRunner(defaultDevRunnerDeps());
    await runner.run(entryPath);
};
