import { error } from "@gtkx/utils";
import { resolve } from "node:path";
import { resolveDataDir } from "../internal/data-dir.js";
import { prepareDevIconDir } from "./icon-dir.js";
import { createDevRunner } from "./runner.js";
import { prepareDevSchemaDir } from "./schema-dir.js";

const ENTRY_ARG_INDEX = 2;

const main = async (): Promise<void> => {
    if (process.channel) {
        process.once("disconnect", () => {
            process.exit(0);
        });
    }

    const cwd = process.cwd();
    const entryArg = process.argv[ENTRY_ARG_INDEX];

    if (!entryArg) {
        error("Missing entry argument");
        process.exit(1);
    }

    const dataDir = resolveDataDir(cwd);
    prepareDevSchemaDir(cwd, dataDir);
    prepareDevIconDir(cwd, dataDir);
    const entryPath = resolve(cwd, entryArg);
    const { defaultDevRunnerDeps } = await import("./runner-deps.js");
    const runner = createDevRunner(defaultDevRunnerDeps());
    await runner.run(entryPath);
};

export { main };
