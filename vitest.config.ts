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
            include: [
                "packages/animate/src/**/*.{ts,tsx}",
                "packages/cli/src/**/*.{ts,tsx}",
                "packages/codegen/src/**/*.{ts,tsx}",
                "packages/config/src/**/*.{ts,tsx}",
                "packages/create-gtkx/src/**/*.{ts,tsx}",
                "packages/css/src/**/*.{ts,tsx}",
                "packages/ffi/src/**/*.{ts,tsx}",
                "packages/gl/src/**/*.{ts,tsx}",
                "packages/mcp/src/**/*.{ts,tsx}",
                "packages/native/{index,types}.ts",
                "packages/react/src/**/*.{ts,tsx}",
                "packages/testing/src/**/*.{ts,tsx}",
                "packages/utils/src/**/*.{ts,tsx}",
            ],
            exclude: [
                "**/dist/**",
                "**/out-tsc/**",
                "**/*.test.{ts,tsx}",
                "**/*.spec.{ts,tsx}",
                "packages/codegen/src/templates/**",
                "packages/gl/src/generated/**",
            ],
        },
    },
});
