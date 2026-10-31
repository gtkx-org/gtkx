import { ensureStoreLinks } from "@gtkx/codegen/internal";
import { createConfigLoader, LIBRARY_APPLICATION_ID } from "@gtkx/config/internal";
import { resolve } from "node:path";
import { createProjectStaging } from "../internal/project-staging.js";
import { storybookApplicationId } from "../storybook/entry.js";
import { receiveDevRunnerBootstrap } from "./bootstrap.js";
import { prepareDevFontDir } from "./font-dir.js";
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
    const { entryPath: entryArg, configFile, storybookConfig, mcpSocketPath } = await receiveDevRunnerBootstrap();
    const loadConfig = createConfigLoader({
        mode: "development",
        configFile,
        shouldWarnGraduatedFuture: false,
        defaultApplicationId: storybookConfig === undefined ? undefined : LIBRARY_APPLICATION_ID,
    });
    const { config, root, translationDomain } = await loadConfig.load(cwd);
    const staging = createProjectStaging();
    const localeDir = await prepareDevLocaleDir(root, translationDomain);
    prepareDevSchemaDir(root, staging.schemas);
    prepareDevIconDir(root, config.applicationId, config.applicationIcon);
    prepareDevFontDir(root, staging.fonts);
    const entryPath = resolve(cwd, entryArg);
    ensureStoreLinks(root);
    const { defaultDevRunnerDeps } = await import("./runner-deps.js");
    const runner = createDevRunner(
        defaultDevRunnerDeps(configFile, config.deploy?.outDir, {
            translationDomain,
            mcpApplicationId:
                storybookConfig === undefined ? config.applicationId : storybookApplicationId(config.applicationId),
            loadConfig,
            mcpSocketPath,
            staging,
            localeDir,
        }),
        { storybookConfig },
    );
    await runner.run(entryPath);
};

export { main };
