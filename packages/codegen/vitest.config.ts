import { defineConfig } from "vitest/config";

export default defineConfig({
    extends: true,
    test: {
        name: "codegen",
        testTimeout: 120000,
    },
});
