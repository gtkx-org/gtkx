import type { UserConfig } from "vite";
import type { Plugin } from "vitest/config";
import { createConfigLoader } from "@gtkx/config/internal";
import { prependSchemaDir, stageAndCompileProjectSchemas } from "../settings/schema.js";

function gtkxSettingsWorkerEnv(configFile?: string): Plugin {
    const loadConfig = createConfigLoader({ configFile });

    return {
        name: "gtkx:settings-worker-env",
        enforce: "pre",

        async config(config: UserConfig) {
            const loaded = await loadConfig.load(config.root ?? process.cwd());
            const dir = stageAndCompileProjectSchemas(loaded.root);

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
