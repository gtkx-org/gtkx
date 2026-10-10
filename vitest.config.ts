import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "scripts",
        include: ["scripts/**/*.test.ts", "packages/native/tools/**/*.test.ts"],
    },
});
