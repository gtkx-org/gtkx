import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["./tests/setup.ts"],
        bail: 1,
        env: {
            LANG: "C.UTF-8",
            LANGUAGE: "en",
            LC_ALL: "C.UTF-8",
        },
    },
});
