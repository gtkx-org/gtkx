import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { RUST_NIGHTLY } from "./rust-nightly.js";

const ASAN_OPTIONS = "detect_leaks=0:verify_asan_link_order=0:halt_on_error=1:abort_on_error=1";
const WORKSPACE_ROOT = join(import.meta.dirname, "..");
const NATIVE_ROOT = join(WORKSPACE_ROOT, "packages", "native");
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

const run = (command: string, args: string[], env: NodeJS.ProcessEnv, cwd = WORKSPACE_ROOT): void => {
    execFileSync(resolveExecutable(command), args, { stdio: "inherit", env, cwd });
};

run("pnpm", [...BUILD_ARGS, "--target", "x86_64-unknown-linux-gnu"], {
    ...process.env,
    RUSTFLAGS: "-Zsanitizer=address",
    RUSTUP_TOOLCHAIN: RUST_NIGHTLY,
});

try {
    run("node", ["--expose-gc", "--test", "--test-name-pattern", "memory|symbols|worker",
        "node-tests/native.test.mjs"], {
        ...process.env,
        ASAN_OPTIONS,
        LD_PRELOAD: asanRuntime(),
    }, NATIVE_ROOT);
} finally {
    run("pnpm", BUILD_ARGS, process.env);
}
