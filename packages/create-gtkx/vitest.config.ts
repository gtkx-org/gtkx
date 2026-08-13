import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        test: {
            name: "create-gtkx",
            include: ["tests/**/*.test.{ts,tsx}"],
            testTimeout: 120_000,
            hookTimeout: 120_000,
        },
    }),
);
