import { sourceResolveConfig } from "@gtkx/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    defineConfig({ ...sourceResolveConfig }),
    defineConfig({
        test: {
            name: "create-gtkx",
            include: ["tests/**/*.test.{ts,tsx}"],
        },
    }),
);
