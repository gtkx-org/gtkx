import gtkx from "@gtkx/vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { sourceResolveConfig } from "../../../../vitest.config.base.js";

const MALLOC_DEBUG_CANDIDATES = [
    "/usr/lib/x86_64-linux-gnu/libc_malloc_debug.so.0",
    "/usr/lib/aarch64-linux-gnu/libc_malloc_debug.so.0",
    "/usr/lib64/libc_malloc_debug.so.0",
];

const nativeTests = fileURLToPath(new URL(".", import.meta.url));
const fixtureLibraries = join(nativeTests, "../../../../build/native-tests/gi-tests/build");

const libraryPath = [fixtureLibraries, process.env.LD_LIBRARY_PATH]
    .filter((entry) => entry !== undefined && entry !== "")
    .join(":");

/**
 * Cheap heap checking for the ordinary run: perturbing freed memory turns a use-after-free read
 * into obvious garbage, and glibc's malloc debugger catches an overrun or a delayed double free at
 * the next allocation. The sanitizer lane preloads its own runtime and checks far more, so it must
 * not have a second allocator wrapper layered underneath.
 */
const heapChecking = (): Record<string, string> => {
    if (process.env.GTKX_ASAN_RUNTIME !== undefined) {
        return {};
    }

    const mallocDebug = MALLOC_DEBUG_CANDIDATES.find((candidate) => existsSync(candidate));
    const perturb = { MALLOC_PERTURB_: "85", GLIBC_TUNABLES: "glibc.malloc.tcache_count=0" };

    if (mallocDebug === undefined) {
        console.warn(
            "libc_malloc_debug.so.0 was not found, so heap writes past an allocation and delayed " +
            "double frees go unchecked in this run. Install it with `sudo dnf install glibc-utils` " +
            "on Fedora; Debian and Ubuntu ship it inside libc6.",
        );

        return perturb;
    }

    return { ...perturb, LD_PRELOAD: mallocDebug, MALLOC_CHECK_: "3" };
};

export default mergeConfig(
    sourceResolveConfig,
    defineConfig({
        root: nativeTests,
        plugins: [gtkx()],
        test: {
            name: "e2e-native",
            include: ["**/*.test.ts"],
            execArgv: ["--expose-gc"],
            env: {
                ...heapChecking(),
                LD_LIBRARY_PATH: libraryPath,
            },
        },
    }),
);
