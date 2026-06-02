import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        bail: 1,
        name: "codegen",
        include: ["tests/**/*.test.{ts,tsx}"],
        testTimeout: 120000,
    },
});
