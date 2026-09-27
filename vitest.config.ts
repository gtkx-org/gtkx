import { defineConfig } from "vitest/config";

const projects = [
    "packages/*/vitest.config.ts",
    "packages/e2e/tests/native/vitest.config.ts",
    "examples/gtk-demo/vitest.config.ts",
    "examples/storybook/vitest.config.ts",
];
const coverageProjects = (): string[] => {
    switch (process.env.GTKX_COVERAGE_GROUP) {
        case undefined: {
            return projects;
        }
        case "core": {
            return [...projects, "!packages/cli/vitest.config.ts", "!packages/mcp/vitest.config.ts"];
        }
        case "cli": {
            return ["packages/cli/vitest.config.ts"];
        }
        case "mcp": {
            return ["packages/mcp/vitest.config.ts"];
        }
        default: {
            throw new Error("Unknown coverage project group");
        }
    }
};
const projectConfig = process.env.GTKX_COVERAGE_MERGE === undefined
    ? { projects: coverageProjects() }
    : {};

export default defineConfig({
    test: {
        ...projectConfig,
        coverage: {
            provider: "v8",
            allowExternal: true,
            reporter: process.env.GTKX_COVERAGE_SHARD === undefined ? ["lcovonly", "text-summary"] : [],
            reportsDirectory: "coverage",
            include: ["packages/*/src/**/*.{ts,tsx}", "packages/native/{binding,bootstrap,internal,main}.js"],
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
