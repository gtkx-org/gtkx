import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        conditions: ["development", "default"],
    },
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        typecheck: {
            tsconfig: "tsconfig.test.json",
        },
    },
});
