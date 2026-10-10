import { resolveExecutable } from "@gtkx/utils";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { nativeCoverage as COVERAGE, nativeTests as NATIVE_TESTS } from "../../e2e/tests/native/paths.js";

const NATIVE_ROOT = join(import.meta.dirname, "..");
const SUPPRESSIONS = join(NATIVE_TESTS, "lsan.supp");
const CONFIGS = [join(NATIVE_TESTS, "vitest.config.ts")];
const VITEST_ARGS = process.argv.slice(2);
const FULL_SUITE = VITEST_ARGS.length === 0;
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
        CARGO_ENCODED_RUSTFLAGS: "-Zsanitizer=address",
        RUSTFLAGS: "-Zsanitizer=address",
        RUSTUP_TOOLCHAIN: nightly,
    },
);

if (FULL_SUITE) rmSync(COVERAGE, { recursive: true, force: true });

const testEnvironment = {
    ...process.env,
    NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        `--import=${pathToFileURL(join(import.meta.dirname, "asan-loader.ts")).href}`,
    ]
        .filter(Boolean)
        .join(" "),
    LD_PRELOAD: runtime,
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
    const probe = spawnSync(
        resolveExecutable("pnpm"),
        ["exec", "vitest", "run", "--root", dirname(config), "--config", config, "--project", "e2e-native-leak-probe"],
        {
            env: testEnvironment,
            cwd: NATIVE_ROOT,
            encoding: "utf8",
            timeout: 120_000,
        },
    );
    const probeOutput = `${probe.stdout ?? ""}${probe.stderr ?? ""}`;

    if (
        probe.status !== 1 ||
        !probeOutput.includes("LeakSanitizer found unreleased native allocations after this test")
    ) {
        throw new Error(`The per-test leak check did not reject its canary:\n${probeOutput}`, { cause: probe.error });
    }

    console.info("The per-test LeakSanitizer canary rejected its deliberate leak.");
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
            "--project",
            FULL_SUITE ? "e2e-native" : "e2e-native-filtered",
            "--testTimeout",
            "120000",
            ...VITEST_ARGS,
        ],
        testEnvironment,
    );
}

if (FULL_SUITE) {
    run("pnpm", ["exec", "tsx", join(NATIVE_TESTS, "../helpers/native-fixtures-coverage.ts")], process.env);
}
