import gtkx from "@gtkx/vitest";
import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        plugins: [gtkx()],
        test: {
            env: {
                GTKX_LOCALE_DIR: resolve(import.meta.dirname, "tests/fixtures/locale"),
                LANG: "fr_FR.UTF-8",
                LANGUAGE: "fr",
                LC_ALL: "fr_FR.UTF-8",
            },
            name: "i18n",
        },
    }),
);
