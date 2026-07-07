import { sourceResolveConfig } from "../../vitest.source.js";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        test: {
            name: "create-gtkx",
            include: ["tests/**/*.test.{ts,tsx}"],
        },
    }),
);
