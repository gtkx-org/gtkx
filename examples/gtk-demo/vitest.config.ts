import gtkx from "@gtkx/cli/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        bail: 1,
        name: "gtk-demo",
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["./tests/setup.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/**/*.d.ts", "src/demos/types.ts"],
            reporter: ["text", "html", "lcov"],
            thresholds: {
                lines: 80,
            },
        },
    },
});
