import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "utils",
        include: ["tests/**/*.test.{ts,tsx}"],
    },
});
