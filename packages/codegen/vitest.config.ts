import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "codegen",
        testTimeout: 120000,
    },
});
