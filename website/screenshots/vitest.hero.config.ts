import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["**/hero-editor.stage.tsx"],
        testTimeout: 60_000,
    },
});
