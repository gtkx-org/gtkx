import { fileURLToPath } from "node:url";
import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

const reactSrc = fileURLToPath(new URL("../react/src/index.ts", import.meta.url));

export default defineConfig({
    plugins: [gtkx()],
    resolve: {
        alias: {
            "@gtkx/react": reactSrc,
        },
    },
    test: {
        name: "e2e",
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["./tests/setup.ts"],
    },
});
