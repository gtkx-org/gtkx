import gtkx from "@gtkx/cli/vitest-plugin";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    root,
    test: {
        projects: [
            mergeConfig(sourceResolveConfig, {
                root,
                plugins: [...gtkx()],
                test: {
                    name: "integration",
                    include: ["tests/**/*.test.{ts,tsx}"],
                    exclude: [
                        ...configDefaults.exclude,
                        "tests/{cli,mcp,create-gtkx,native}/**",
                        "tests/{publish,tutorial}.test.ts",
                    ],
                    setupFiles: ["./tests/setup.ts"],
                    execArgv: ["--expose-gc"],
                },
            }),
            "./tests/native/vitest.config.ts",
        ],
    },
});
