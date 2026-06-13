import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    extends: true,
    plugins: [gtkx()],
    test: {
        name: "e2e",
        setupFiles: ["./tests/setup.ts"],
    },
});
