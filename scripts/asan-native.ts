import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { RUST_NIGHTLY } from "./rust-nightly.js";

const WORKSPACE_ROOT = join(import.meta.dirname, "..");
const NATIVE_TESTS = join(WORKSPACE_ROOT, "packages", "e2e", "tests", "native");
const SUPPRESSIONS = join(NATIVE_TESTS, "lsan.supp");
const NATIVE_CONFIG = join(NATIVE_TESTS, "vitest.config.ts");
const BUILD_ARGS = ["--filter", "@gtkx/native", "exec", "napi", "build", "--platform", "--release", "--esm",
    "--no-dts-cache", "--no-const-enum"];

const asanRuntime = (): string => {
    const gcc = resolveExecutable("gcc");
    const printed = execFileSync(gcc, ["-print-file-name=libasan.so.8"], { encoding: "utf8" }).trim();

    if (printed === "libasan.so.8") {
        throw new Error("The AddressSanitizer runtime is missing; install libasan");
    }

    return printed;
};

const run = (command: string, args: string[], env: NodeJS.ProcessEnv): void => {
    execFileSync(resolveExecutable(command), args, { stdio: "inherit", env, cwd: WORKSPACE_ROOT });
};

run("pnpm", [...BUILD_ARGS, "--target", "x86_64-unknown-linux-gnu"], {
    ...process.env,
    RUSTFLAGS: "-Zsanitizer=address",
    RUSTUP_TOOLCHAIN: RUST_NIGHTLY,
});

const runtime = asanRuntime();

try {
    run("pnpm", ["exec", "vitest", "run", "--config", NATIVE_CONFIG], {
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
} finally {
    run("pnpm", BUILD_ARGS, process.env);
}
