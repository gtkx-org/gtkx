import { join } from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../../../vitest.config.base.js";
import type { NativeTestContext } from "./context.js";
import { nativeCoverage, nativeTests } from "../../../native/tools/test-paths.js";

const fixtureLibraries = join(nativeTests, "../../../../build/native-tests/gi-tests/build");
const asanRuntime = process.env.LD_PRELOAD;

if (asanRuntime === undefined || !process.env.ASAN_OPTIONS?.split(":").includes("detect_leaks=1")) {
    throw new Error("Native E2E tests require AddressSanitizer and LeakSanitizer. Run pnpm test:asan.");
}

const project = (name: string, include: string[], context: NativeTestContext) =>
    mergeConfig(
        sourceResolveConfig,
        defineConfig({
            root: nativeTests,
            test: {
                name,
                include,
                setupFiles: ["./setup.ts"],
                pool: "forks",
                execArgv: ["--expose-gc"],
                sequence: { hooks: "stack", concurrent: false },
                provide: { nativeTest: context },
                env: {
                    LD_LIBRARY_PATH: [fixtureLibraries, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
                },
            },
        }),
    );

export default defineConfig({
    root: nativeTests,
    test: {
        projects: [
            project("e2e-native", ["**/*.test.ts"], { asanRuntime, coverageDirectory: nativeCoverage }),
            project("e2e-native-filtered", ["**/*.test.ts"], { asanRuntime }),
            project("e2e-native-leak-probe", ["leak-probe.ts"], { asanRuntime }),
        ],
    },
});
