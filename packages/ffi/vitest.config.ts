import { mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.config.js";

export default mergeConfig(baseConfig, {
    test: {
        include: ["tests/**/*.test.ts"],
        pool: "forks",
        maxWorkers: 1,
        isolate: true,
        fileParallelism: false,
        sequence: {
            hooks: "list",
        },
        globalSetup: "./tests/global-setup.ts",
        setupFiles: ["./tests/vitest-setup.ts"],
    },
});
