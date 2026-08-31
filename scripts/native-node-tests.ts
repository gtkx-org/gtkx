import { resolveExecutable } from "@gtkx/utils";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    resolveHeadlessOptions,
    startHeadlessDisplay,
    STATIC_HEADLESS_ENV,
} from "../packages/vitest/src/headless-display.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesBuildDir = join(root, "build", "native-tests", "gi-tests", "build");

if (!existsSync(join(fixturesBuildDir, "libregress.so"))) {
    throw new Error("The GI test fixtures are missing; run `nx run @gtkx/e2e:test-fixtures` first");
}

const testRoot = join(root, "packages", "e2e");
const suppressions = join(testRoot, "node-tests", "lsan.supp");
const isAsan = process.env.GTKX_NATIVE_ASAN === "1";

const asanRuntime = (): string => {
    const gcc = resolveExecutable("gcc");
    const printed = execFileSync(gcc, ["-print-file-name=libasan.so.8"], { encoding: "utf8" }).trim();

    if (printed === "libasan.so.8") {
        throw new Error("The AddressSanitizer runtime is missing; install libasan");
    }

    return printed;
};

const mallocDebugRuntime = (): string | undefined => {
    const candidates = [
        "/usr/lib/x86_64-linux-gnu/libc_malloc_debug.so.0",
        "/usr/lib/aarch64-linux-gnu/libc_malloc_debug.so.0",
        "/usr/lib64/libc_malloc_debug.so.0",
    ];

    return candidates.find((candidate) => existsSync(candidate));
};

const memoryEnv = (): NodeJS.ProcessEnv => {
    if (isAsan) {
        const runtime = asanRuntime();

        return {
            LD_PRELOAD: runtime,
            GTKX_ASAN_RUNTIME: runtime,
            ASAN_OPTIONS: [
                "detect_leaks=1",
                "fast_unwind_on_malloc=0",
                "malloc_context_size=30",
                "verify_asan_link_order=0",
                "abort_on_error=1",
                "exitcode=66",
            ].join(":"),
            LSAN_OPTIONS: [`suppressions=${suppressions}`, "leak_check_at_exit=0"].join(":"),
        };
    }

    const mallocDebug = mallocDebugRuntime();

    if (mallocDebug === undefined) {
        console.warn(
            "libc_malloc_debug.so.0 was not found, so heap writes past an allocation and delayed " +
            "double frees go unchecked in this run. Install it with `sudo dnf install glibc-utils` " +
            "on Fedora; Debian and Ubuntu ship it inside libc6.",
        );

        return { MALLOC_PERTURB_: "85", GLIBC_TUNABLES: "glibc.malloc.tcache_count=0" };
    }

    return {
        LD_PRELOAD: mallocDebug,
        MALLOC_CHECK_: "3",
        MALLOC_PERTURB_: "85",
        GLIBC_TUNABLES: "glibc.malloc.tcache_count=0",
    };
};

const teardown = await startHeadlessDisplay(resolveHeadlessOptions({}));

try {
    const extraArgs = process.argv.slice(2);
    const hasTargets = extraArgs.some((argument) => !argument.startsWith("-"));
    const result = spawnSync(
        resolveExecutable("node"),
        ["--expose-gc", "--test", ...extraArgs, ...(hasTargets ? [] : ["node-tests/*.test.mjs"])],
        {
            cwd: testRoot,
            stdio: "inherit",
            env: {
                ...process.env,
                ...STATIC_HEADLESS_ENV,
                ...memoryEnv(),
                LD_LIBRARY_PATH: [fixturesBuildDir, process.env.LD_LIBRARY_PATH]
                    .filter((entry) => entry !== undefined && entry !== "")
                    .join(":"),
            },
        },
    );

    process.exitCode = result.status ?? 1;
} finally {
    teardown();
}
