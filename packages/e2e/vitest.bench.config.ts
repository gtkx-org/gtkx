import codspeedPlugin from "@codspeed/vitest-plugin";
import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx(), codspeedPlugin()],
    test: {
        name: "e2e-bench",
        setupFiles: ["./tests/setup.ts"],
        benchmark: {
            include: ["bench/**/*.bench.{ts,tsx}"],
        },
    },
});
