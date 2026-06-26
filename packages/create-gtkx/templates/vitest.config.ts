import gtkx from "@gtkx/cli/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        globals: false,
        bail: 1,
    },
});
