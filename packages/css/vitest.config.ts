import gtkx from "@gtkx/vitest";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.source.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        plugins: [gtkx()],
        test: {
            name: "css",
        },
    }),
);
