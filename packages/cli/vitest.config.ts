import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        typecheck: {
            tsconfig: "tsconfig.test.json",
        },
    },
});
