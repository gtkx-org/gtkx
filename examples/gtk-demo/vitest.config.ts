import gtkx from "@gtkx/cli/vitest-plugin";
import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../vitest.config.base.js";

export default defineConfig(() => {
    const dataDir = fileURLToPath(new URL("tests/fixtures/data", import.meta.url));
    const schemaDir = fileURLToPath(new URL("tests/fixtures/settings", import.meta.url));
    execFileSync(resolveExecutable("glib-compile-schemas"), ["--strict", schemaDir]);

    return mergeConfig(sourceResolveConfig, {
        plugins: [gtkx()],
        test: {
            bail: 1,
            env: {
                GSETTINGS_BACKEND: "memory",
                GSETTINGS_SCHEMA_DIR: [schemaDir, process.env.GSETTINGS_SCHEMA_DIR].filter(Boolean).join(":"),
                XDG_DATA_HOME: dataDir,
            },
            name: "gtk-demo",
            include: ["tests/**/*.test.{ts,tsx}"],
            setupFiles: ["./tests/setup.ts"],
            coverage: {
                provider: "v8",
                include: ["src/**/*.{ts,tsx}"],
                exclude: ["src/**/*.d.ts", "src/demos/types.ts"],
                reporter: ["text", "html", "lcov"],
                thresholds: {
                    lines: 80,
                },
            },
        },
    });
});
