import { loadConfig } from "@gtkx/config";
import { error } from "@gtkx/utils";
import { resolve } from "node:path";
import { DEV_ENTRY_ENV } from "./entry-env.js";
import { prepareDevIconDir } from "./icon-dir.js";
import { prepareDevLocaleDir } from "./locale-dir.js";
import { createDevRunner } from "./runner.js";
import { prepareDevSchemaDir } from "./schema-dir.js";

const main = async (): Promise<void> => {
    if (process.channel) {
        process.once("disconnect", () => {
            process.exit(0);
        });
    }

    const cwd = process.cwd();
    const entryArg = process.env[DEV_ENTRY_ENV];

    if (!entryArg) {
        error(`Missing ${DEV_ENTRY_ENV}`);
        process.exit(1);
    }

    const { config, root } = await loadConfig(cwd, { mode: "development" });
    prepareDevLocaleDir(root, config.applicationId);
    prepareDevSchemaDir(root);
    prepareDevIconDir(root, config.applicationId, config.applicationIcon);
    const entryPath = resolve(cwd, entryArg);
    const { defaultDevRunnerDeps } = await import("./runner-deps.js");
    const runner = createDevRunner(defaultDevRunnerDeps());
    await runner.run(entryPath);
};

export { main };
