import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx({ setupFiles: ["tests/module/setup.ts"] })],
    test: {
        include: ["tests/**/*.test.ts"],
        typecheck: {
            tsconfig: "tsconfig.test.json",
        },
        bail: 1,
        execArgv: ["--expose-gc"],
    },
});
