import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    test: {
        name: "acceptance",
        include: ["tests/{publish,tutorial}.test.ts"],
        globalSetup: ["./tests/helpers/registry-setup.ts"],
        fileParallelism: false,
        maxWorkers: 1,
        testTimeout: 1_800_000,
        hookTimeout: 1_800_000,
    },
});
