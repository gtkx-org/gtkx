import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        name: "css",
        include: ["tests/**/*.test.{ts,tsx}"],
    },
});
