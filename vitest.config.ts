import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            "packages/*/vitest.config.ts",
            "packages/e2e/tests/native/vitest.config.ts",
            "examples/gtk-demo/vitest.config.ts",
            "examples/storybook/vitest.config.ts",
        ],
    },
});
