import { resolve } from "node:path";
import { error } from "@gtkx/utils";
import { resolveDataDir } from "../internal/data-dir.js";
import { createDevRunner } from "./runner.js";
import { prepareDevSchemaDir } from "./schema-dir.js";

const ENTRY_ARG_INDEX = 2;

export const main = async (): Promise<void> => {
    const cwd = process.cwd();
    const entryArg = process.argv[ENTRY_ARG_INDEX];

    if (!entryArg) {
        error("Missing entry argument");
        process.exit(1);
    }

    prepareDevSchemaDir(cwd, resolveDataDir(cwd));

    const entryPath = resolve(cwd, entryArg);
    const { defaultDevRunnerDeps } = await import("./runner-deps.js");
    const runner = createDevRunner(defaultDevRunnerDeps());
    await runner.run(entryPath);
};
