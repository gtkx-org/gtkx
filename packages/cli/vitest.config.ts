import gtkx from "@gtkx/vitest";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        plugins: [gtkx()],
        test: {
            name: "cli",
            testTimeout: 600_000,
            hookTimeout: 600_000,
        },
    }),
);
