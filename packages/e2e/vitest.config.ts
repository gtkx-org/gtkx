import gtkx from "@gtkx/vitest";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    root,
    test: {
        projects: [
            mergeConfig(sourceResolveConfig, {
                root,
                plugins: [gtkx()],
                test: {
                    name: "cli-e2e",
                    include: ["tests/{cli,mcp,create-gtkx}/**/*.test.ts"],
                    testTimeout: 600_000,
                    hookTimeout: 600_000,
                    sequence: { groupOrder: 0 },
                },
            }),
            {
                root,
                test: {
                    name: "publish-e2e",
                    include: ["tests/{publish,tutorial}.test.ts"],
                    globalSetup: ["./tests/helpers/registry-setup.ts"],
                    fileParallelism: false,
                    maxWorkers: 1,
                    testTimeout: 1_800_000,
                    hookTimeout: 1_800_000,
                    sequence: { groupOrder: 1 },
                },
            },
        ],
    },
});
