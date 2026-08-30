import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { RUST_NIGHTLY } from "./rust-nightly.js";

const WORKSPACE_ROOT = join(import.meta.dirname, "..");
const BUILD_ARGS = ["--filter", "@gtkx/native", "exec", "napi", "build", "--platform", "--release", "--esm",
    "--no-dts-cache", "--no-const-enum"];

const run = (command: string, args: string[], env: NodeJS.ProcessEnv): void => {
    execFileSync(resolveExecutable(command), args, { stdio: "inherit", env, cwd: WORKSPACE_ROOT });
};

run("pnpm", [...BUILD_ARGS, "--target", "x86_64-unknown-linux-gnu"], {
    ...process.env,
    RUSTFLAGS: "-Zsanitizer=address",
    RUSTUP_TOOLCHAIN: RUST_NIGHTLY,
});

try {
    run("pnpm", ["exec", "tsx", "scripts/native-node-tests.ts"], {
        ...process.env,
        GTKX_NATIVE_ASAN: "1",
    });
} finally {
    run("pnpm", BUILD_ARGS, process.env);
}
