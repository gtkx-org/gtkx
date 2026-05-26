import { gtkxResources } from "@gtkx/cli/vite-plugins/gresources";
import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";
import gtkxConfig from "./gtkx.config.js";

export default defineConfig({
    plugins: [gtkxResources({ applicationId: gtkxConfig.applicationId }), gtkx()],
    test: {
        name: "gtk-demo",
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["./tests/setup.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/**/*.d.ts", "src/demos/types.ts"],
            reporter: ["text", "html", "lcov"],
            thresholds: {
                lines: 85,
                statements: 85,
                functions: 85,
                branches: 60,
            },
        },
    },
});
