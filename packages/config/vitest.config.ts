import { sourceResolveConfig } from "../../vitest.source.js";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        test: {
            name: "config",
        },
    }),
);
