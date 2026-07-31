import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { RUST_NIGHTLY } from "./rust-nightly.js";

const ASAN_OPTIONS = "detect_leaks=0:verify_asan_link_order=0:halt_on_error=0:abort_on_error=0";
const SANDBOXED_SPECS = "tests/runtime/promisify.test.ts";

const BUILD_ARGS = ["--filter", "@gtkx/native", "exec", "napi", "build", "--platform", "--release", "--esm",
    "--no-dts-cache", "--no-const-enum"];

const asanRuntime = (): string => {
    const gcc = resolveExecutable("gcc");
    const printed = execFileSync(gcc, ["-print-file-name=libasan.so.8"], { encoding: "utf8" }).trim();

    if (printed === "libasan.so.8") {
        throw new Error("The AddressSanitizer runtime is missing; install libasan (libasan8 on Debian)");
    }

    return printed;
};

const run = (command: string, args: string[], env: NodeJS.ProcessEnv): void => {
    execFileSync(resolveExecutable(command), args, { stdio: "inherit", env });
};

const runAsanE2e = (): void => {
    run("pnpm", [...BUILD_ARGS, "--target", "x86_64-unknown-linux-gnu"], {
        ...process.env,
        RUSTFLAGS: "-Zsanitizer=address",
        RUSTUP_TOOLCHAIN: RUST_NIGHTLY,
    });

    try {
        run("pnpm", ["exec", "vitest", "run", "--project", "e2e", "--exclude", SANDBOXED_SPECS], {
            ...process.env,
            ASAN_OPTIONS,
            LD_PRELOAD: asanRuntime(),
        });
    } finally {
        run("pnpm", BUILD_ARGS, process.env);
    }
};

runAsanE2e();
