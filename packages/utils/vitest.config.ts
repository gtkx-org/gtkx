import { sourceResolveConfig } from "../../vitest.source.js";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    defineConfig({ ...sourceResolveConfig }),
    defineConfig({
        test: {
            name: "utils",
        },
    }),
);
