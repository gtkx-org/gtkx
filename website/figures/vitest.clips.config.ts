import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        plugins: [gtkx()],
        test: {
            name: "website-clips",
            include: ["record.test.tsx"],
            setupFiles: ["./setup.ts"],
            testTimeout: 120_000,
            env: {
                LANG: "C.UTF-8",
                LANGUAGE: "en",
                LC_ALL: "C.UTF-8",
            },
        },
    }),
);
