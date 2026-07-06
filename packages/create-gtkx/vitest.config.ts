import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

export default mergeConfig(
    shared,
    defineConfig({
        test: {
            name: "create-gtkx",
            include: ["tests/**/*.test.{ts,tsx}"],
        },
    }),
);
