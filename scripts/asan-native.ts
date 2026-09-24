import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempDisposableSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { RUST_NIGHTLY } from "./rust-nightly.js";

const WORKSPACE_ROOT = join(import.meta.dirname, "..");
const NATIVE_TESTS = join(WORKSPACE_ROOT, "packages", "e2e", "tests", "native");
const SUPPRESSIONS = join(NATIVE_TESTS, "lsan.supp");
const NATIVE_CONFIGS = [
    join(WORKSPACE_ROOT, "packages", "native", "vitest.config.ts"),
    join(NATIVE_TESTS, "vitest.config.ts"),
];
const BUILD_ARGS = ["--filter", "@gtkx/native", "exec", "napi", "build", "--platform", "--release", "--esm",
    "--no-dts-cache", "--no-const-enum"];

const nativeTarget = (): string => {
    const output = execFileSync(resolveExecutable("rustc"), ["-vV"], {
        encoding: "utf8",
        env: { ...process.env, RUSTUP_TOOLCHAIN: RUST_NIGHTLY },
    });
    const host = output.split("\n").find((line) => line.startsWith("host: "))?.slice("host: ".length);

    if (host === undefined) {
        throw new Error("The Rust compiler did not report its host target");
    }

    return host;
};

const asanRuntime = (): string => {
    const gcc = resolveExecutable("gcc");
    const linkerInput = execFileSync(gcc, ["-print-file-name=libasan.so"], { encoding: "utf8" }).trim();

    if (linkerInput === "libasan.so") {
        throw new Error("The AddressSanitizer runtime is missing; install libasan");
    }

    using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-asan-runtime-"));
    const trace = execFileSync(
        resolveExecutable("ld"),
        ["--trace", linkerInput, "--entry=0", "-o", join(temporary.path, "probe")],
        { encoding: "utf8" },
    );
    const runtime = trace
        .trim()
        .split("\n")
        .findLast((path) => basename(path).startsWith("libasan.so"));

    if (runtime === undefined) {
        throw new Error("The linker did not resolve the AddressSanitizer runtime");
    }

    return runtime;
};

const run = (command: string, args: string[], env: NodeJS.ProcessEnv): void => {
    execFileSync(resolveExecutable(command), args, { stdio: "inherit", env, cwd: WORKSPACE_ROOT });
};

const runtime = asanRuntime();
const target = nativeTarget();

try {
    run("pnpm", [...BUILD_ARGS, "--target", target], {
        ...process.env,
        RUSTFLAGS: "-Zsanitizer=address",
        RUSTUP_TOOLCHAIN: RUST_NIGHTLY,
    });

    for (const config of NATIVE_CONFIGS) {
        const args = [
            "exec", "vitest", "run", "--root", dirname(config), "--config", config, "--testTimeout", "120000",
        ];
        run("pnpm", args, {
            ...process.env,
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
            LSAN_OPTIONS: [`suppressions=${SUPPRESSIONS}`, "leak_check_at_exit=0"].join(":"),
        });
    }
} finally {
    run("pnpm", BUILD_ARGS, process.env);
}
