import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const NATIVE_ROOT = join(import.meta.dirname, "..");
const NATIVE_TESTS = join(NATIVE_ROOT, "..", "e2e", "tests", "native");
const SUPPRESSIONS = join(NATIVE_TESTS, "lsan.supp");
const CONFIGS = [join(NATIVE_ROOT, "vitest.config.ts"), join(NATIVE_TESTS, "vitest.config.ts")];
const VITEST_ARGS = process.argv.slice(2);
const OUTPUT = join(NATIVE_ROOT, "build", "asan");
const nightlyEnvironment = { ...process.env };
delete nightlyEnvironment.RUSTUP_TOOLCHAIN;

const nightly = execFileSync(resolveExecutable("rustup"), ["show", "active-toolchain"], {
    cwd: import.meta.dirname,
    encoding: "utf8",
    env: nightlyEnvironment,
})
    .trim()
    .split(" ")[0];

if (nightly === undefined || !nightly.startsWith("nightly-")) {
    throw new Error("The native tools directory must select a pinned nightly Rust toolchain");
}

const architecture = process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : undefined;

if (architecture === undefined) {
    throw new Error(`Unsupported sanitizer architecture: ${process.arch}`);
}

const asanRuntime = (): string => {
    const gcc = resolveExecutable("gcc");
    const printed = execFileSync(gcc, ["-print-file-name=libasan.so.8"], { encoding: "utf8" }).trim();

    if (printed === "libasan.so.8") {
        throw new Error("The AddressSanitizer runtime is missing; install libasan");
    }

    return printed;
};

const run = (command: string, args: string[], env: NodeJS.ProcessEnv): void => {
    execFileSync(resolveExecutable(command), args, { stdio: "inherit", env, cwd: NATIVE_ROOT });
};

const runtime = asanRuntime();

run(
    "pnpm",
    [
        "exec",
        "napi",
        "build",
        "--platform",
        "--release",
        "--esm",
        "--no-dts-cache",
        "--no-const-enum",
        "--target",
        `${architecture}-unknown-linux-gnu`,
        "--target-dir",
        "target/asan",
        "--output-dir",
        OUTPUT,
        "--",
        "--locked",
    ],
    {
        ...process.env,
        RUSTFLAGS: "-Zsanitizer=address",
        RUSTUP_TOOLCHAIN: nightly,
    },
);

const testEnvironment = {
    ...process.env,
    NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        `--import=${pathToFileURL(join(import.meta.dirname, "asan-loader.ts")).href}`,
    ]
        .filter(Boolean)
        .join(" "),
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
    LSAN_OPTIONS: [`suppressions=${SUPPRESSIONS}`, "leak_check_at_exit=0", "print_suppressions=0"].join(":"),
};

for (const config of CONFIGS) {
    run(
        "pnpm",
        [
            "exec",
            "vitest",
            "run",
            "--root",
            dirname(config),
            "--config",
            config,
            "--testTimeout",
            "120000",
            ...VITEST_ARGS,
        ],
        testEnvironment,
    );
}
