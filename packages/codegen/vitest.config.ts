import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        test: {
            name: "codegen",
            testTimeout: 600_000,
        },
    }),
);
