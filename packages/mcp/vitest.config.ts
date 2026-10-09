import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default defineConfig(
    mergeConfig(sourceResolveConfig, {
        root: fileURLToPath(new URL(".", import.meta.url)),
        test: {
            name: "mcp",
            include: ["tests/**/*.test.ts"],
            pool: "forks",
            disableConsoleIntercept: true,
            testTimeout: 120_000,
            hookTimeout: 120_000,
        },
    }),
);
