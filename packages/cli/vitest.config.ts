import createConfigPlugin from "@gtkx/config/vite-plugin";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        plugins: [createConfigPlugin({ name: "gtkx:cli-tests" })],
        test: {
            name: "cli",
        },
    }),
);
