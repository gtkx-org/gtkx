import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../../../vitest.config.base.js";

const nativeTests = fileURLToPath(new URL(".", import.meta.url));
const fixtureLibraries = join(nativeTests, "../../../../build/native-tests/gi-tests/build");

if (process.env.GTKX_ASAN_RUNTIME === undefined || !process.env.ASAN_OPTIONS?.split(":").includes("detect_leaks=1")) {
    throw new Error("Native E2E tests require AddressSanitizer and LeakSanitizer. Run pnpm test:asan.");
}

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        root: nativeTests,
        test: {
            name: "e2e-native",
            include: process.env.GTKX_NATIVE_LEAK_PROBE === "1" ? ["leak-probe.ts"] : ["**/*.test.ts"],
            setupFiles: ["./setup.ts"],
            pool: "forks",
            execArgv: ["--expose-gc"],
            sequence: { hooks: "stack", concurrent: false },
            env: {
                LD_LIBRARY_PATH: [fixtureLibraries, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
            },
        },
    }),
);
