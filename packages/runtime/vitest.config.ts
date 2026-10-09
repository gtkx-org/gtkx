import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        test: {
            name: "runtime",
            pool: "forks",
            fsModuleCache: true,
            setupFiles: ["./tests/setup.ts"],
            execArgv: ["--expose-gc"],
        },
    }),
);
