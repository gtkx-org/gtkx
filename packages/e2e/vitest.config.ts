import gtkx from "@gtkx/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        plugins: [gtkx()],
        test: {
            name: "e2e",
            exclude: [...configDefaults.exclude, "node-tests/**"],
            setupFiles: ["./tests/setup.ts"],
            execArgv: ["--expose-gc"],
        },
    }),
);
