import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        bail: 1,
        name: "mcp",
        include: ["tests/**/*.test.{ts,tsx}"],
    },
});
