import { defineConfig } from "vitest/config";

const projects = [
    "packages/*/vitest.config.ts",
    "packages/e2e/tests/native/vitest.config.ts",
    "examples/gtk-demo/vitest.config.ts",
    "examples/storybook/vitest.config.ts",
];
const projectConfig = process.env.GTKX_COVERAGE_MERGE === undefined
    ? { projects }
    : {};

export default defineConfig({
    test: {
        ...projectConfig,
        coverage: {
            provider: "v8",
            allowExternal: true,
            reporter: process.env.GTKX_COVERAGE_SHARD === undefined ? ["lcovonly", "text-summary"] : [],
            reportsDirectory: "coverage",
            include: ["packages/*/src/**/*.{ts,tsx}"],
            exclude: [
                "**/dist/**",
                "**/out-tsc/**",
                "**/*.d.ts",
                "**/*.test.{ts,tsx}",
                "**/*.spec.{ts,tsx}",
                "packages/e2e/**",
                "packages/vitest/**",
                "packages/gl/src/generated/**",
            ],
        },
    },
});
