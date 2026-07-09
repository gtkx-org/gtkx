import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: ["packages/*/vitest.config.ts", "examples/gtk-demo/vitest.config.ts", "scripts/vitest.config.ts"],
        coverage: {
            provider: "v8",
            allowExternal: true,
            reporter: ["lcov", "text-summary"],
            reportsDirectory: "coverage",
            include: ["packages/*/src/**/*.{ts,tsx}"],
            exclude: [
                "**/dist/**",
                "**/out-tsc/**",
                "**/*.test.{ts,tsx}",
                "**/*.spec.{ts,tsx}",
                "packages/e2e/**",
                "packages/vitest/**",
                "packages/gl/src/generated/**",
            ],
        },
    },
});
