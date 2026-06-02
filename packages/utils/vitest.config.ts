import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        bail: 1,
        name: "utils",
        include: ["tests/**/*.test.{ts,tsx}"],
    },
});
