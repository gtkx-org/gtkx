import type { UserConfig } from "vite";
import type { Plugin } from "vitest/config";
import { createConfigLoader, resolveFuture } from "@gtkx/config/internal";
import { resolveDataDir } from "../internal/data-dir.js";
import { prependSchemaDir, stageAndCompileProjectSchemas } from "../settings/schema.js";

function gtkxSettingsWorkerEnv(): Plugin {
    const loadConfig = createConfigLoader();

    return {
        name: "gtkx:settings-worker-env",
        enforce: "pre",

        async config(config: UserConfig) {
            const loaded = await loadConfig.load(config.root ?? process.cwd());
            const dataDir = resolveFuture(loaded.config.future).isResourceImported ? null : resolveDataDir(loaded.root);
            const dir = stageAndCompileProjectSchemas(loaded.root, dataDir);

            if (dir === null) {
                return;
            }

            process.env.GTKX_DEV_SCHEMA_DIR = dir;

            return {
                test: {
                    env: { GSETTINGS_SCHEMA_DIR: prependSchemaDir(dir, process.env.GSETTINGS_SCHEMA_DIR) },
                },
            };
        },
    };
}

export { gtkxSettingsWorkerEnv };
