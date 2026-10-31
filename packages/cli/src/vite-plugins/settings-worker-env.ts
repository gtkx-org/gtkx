import type { UserConfig } from "vite";
import type { Plugin } from "vitest/config";
import type { ConfigLoader } from "@gtkx/config";
import { viteProjectRoot } from "@gtkx/config/internal";
import type { RetainedStagingDir } from "../internal/staging-dir.js";
import { prependSchemaDir, stageAndCompileProjectSchemas } from "../settings/schema.js";

function gtkxSettingsWorkerEnv(staging: RetainedStagingDir, loadConfig: ConfigLoader): Plugin {
    return {
        name: "gtkx:settings-worker-env",
        enforce: "pre",

        async config(config: UserConfig) {
            const loaded = await loadConfig.load(viteProjectRoot(config));
            const dir = stageAndCompileProjectSchemas(loaded.root, staging);

            if (dir === null) {
                return;
            }

            const existing = config.test?.env?.GSETTINGS_SCHEMA_DIR ?? process.env.GSETTINGS_SCHEMA_DIR;

            return {
                test: {
                    env: { GSETTINGS_SCHEMA_DIR: prependSchemaDir(dir, existing) },
                },
            };
        },
    };
}

export { gtkxSettingsWorkerEnv };
