import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        test: {
            include: ["tests/native/gjs-conformance.test.ts"],
            name: "e2e-conformance",
        },
    }),
);
