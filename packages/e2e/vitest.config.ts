import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        plugins: [...gtkx()],
        test: {
            name: "react-e2e",
            include: ["tests/react/**/*.test.tsx"],
            setupFiles: ["./tests/setup.ts"],
            execArgv: ["--expose-gc"],
        },
    }),
);
