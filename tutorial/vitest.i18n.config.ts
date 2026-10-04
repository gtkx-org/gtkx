import gtkx from "@gtkx/cli/vitest-plugin";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["tests/**/*.i18n.tsx"],
        setupFiles: ["./tests/setup.ts"],
        bail: 1,
        env: {
            GTKX_LOCALE_DIR: resolve(import.meta.dirname, "dist/locale"),
            LANG: "fr_FR.UTF-8",
            LANGUAGE: "fr",
            LC_ALL: "fr_FR.UTF-8",
        },
    },
});
