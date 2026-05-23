import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["**/*.test.{ts,tsx}"],
        bail: 1,
        hookTimeout: 30000,
    },
});
