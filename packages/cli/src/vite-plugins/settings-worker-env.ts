import type { UserConfig } from "vite";
import type { Plugin } from "vitest/config";
import { createConfigLoader } from "@gtkx/config/internal";
import { resolveDataDir } from "../internal/data-dir.js";
import { prependSchemaDir, stageAndCompileProjectSchemas } from "../settings/schema.js";

function gtkxSettingsWorkerEnv(): Plugin {
    const loadConfig = createConfigLoader();

    return {
        name: "gtkx:settings-worker-env",
        enforce: "pre",

        async config(config: UserConfig) {
            const root = config.root ?? process.cwd();
            const loaded = await loadConfig.load(root);
            const dataDir = loaded.config.future?.v2ResourceImports === true ? null : resolveDataDir(root);
            const dir = stageAndCompileProjectSchemas(root, dataDir);

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
