import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "codegen",
        include: ["tests/**/*.test.{ts,tsx}"],
        testTimeout: 120000,
    },
});
