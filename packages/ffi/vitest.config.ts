import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        name: "ffi",
        setupFiles: ["./tests/setup.ts"],
        execArgv: ["--expose-gc"],
    },
});
