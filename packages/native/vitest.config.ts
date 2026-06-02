import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        bail: 1,
        name: "native",
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["./tests/module/setup.ts"],
        execArgv: ["--expose-gc"],
    },
});
