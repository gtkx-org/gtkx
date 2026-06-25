import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: ["packages/*/vitest.config.ts", "examples/gtk-demo/vitest.config.ts"],
        include: ["tests/**/*.test.{ts,tsx}"],
        bail: 1,
        coverage: {
            provider: "v8",
            allowExternal: true,
            reporter: ["lcov", "text-summary"],
            reportsDirectory: "coverage",
            include: ["packages/*/src/**/*.{ts,tsx}", "packages/native/{index,types}.ts"],
            exclude: [
                "**/dist/**",
                "**/out-tsc/**",
                "**/*.test.{ts,tsx}",
                "**/*.spec.{ts,tsx}",
                "packages/e2e/**",
                "packages/vitest/**",
                "packages/codegen/src/templates/**",
                "packages/gl/src/generated/**",
            ],
        },
    },
});
