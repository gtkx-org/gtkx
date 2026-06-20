#!/usr/bin/env node
/**
 * Native CI task runner invoked by `pnpm asan` / `pnpm miri` / `pnpm bench`
 * (locally and from CI). Each subcommand mirrors one CI job.
 *
 * - `asan`: runs the native Rust test suite under AddressSanitizer. The codec,
 *   managed-value, and boxed/fundamental ref-counting paths are where a
 *   double-unref or use-after-free in the FFI lives, and a sanitizer turns such
 *   a defect into a deterministic failure instead of a crash a user only hits
 *   "after GC". The tests are ordinary executables, so the AddressSanitizer
 *   runtime links directly. LeakSanitizer stays off (`detect_leaks=0`): the
 *   dlopen'd GTK libraries are uninstrumented and report benign one-time
 *   allocations, so this targets use-after-free and double-free.
 * - `miri`: runs Miri over the FFI-free marshalling subset. Miri cannot execute
 *   a dlopen'd GTK/GLib, so only the `miri_marshalling` target is reachable — it
 *   touches pointer and per-element index math over Rust-allocated buffers, the
 *   unsafe surface Miri validates for provenance and out-of-bounds access.
 * - `bench`: runs the marshalling and reconciler benchmarks under the CodSpeed
 *   runner. A single `codspeed run` instruments the Rust (cargo-codspeed) and
 *   TypeScript (vitest) suites as one report. The reconciler benches render real
 *   widgets, so the vitest suite runs under a headless weston compositor with
 *   the software renderer; its
 *   `@codspeed/core` addon needs a V8 that Node 26 dropped, so it runs on the
 *   secondary Node 22 in `/opt/node22`. `bench:measured` is the inner command
 *   CodSpeed instruments and is not meant to be invoked directly.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const selfPath = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(selfPath));
const nativeDir = join(repoRoot, "packages", "native");

interface RunOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}

/**
 * Runs a command with inherited stdio, exiting with the child's status code
 * when it fails so the CI job aborts on the first error.
 *
 * @param command - The executable to invoke.
 * @param args - The arguments to pass.
 * @param options - Optional working directory and environment overrides.
 */
function run(command: string, args: string[], options: RunOptions = {}): void {
    const result = spawnSync(command, args, {
        cwd: options.cwd ?? repoRoot,
        env: options.env ?? process.env,
        stdio: "inherit",
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

const tasks: Record<string, () => void> = {
    asan() {
        run(
            "wlheadless-run",
            [
                "-c",
                "weston",
                "--",
                "cargo",
                "+nightly",
                "test",
                "--target",
                "x86_64-unknown-linux-gnu",
                "--",
                "--test-threads=1",
            ],
            {
                cwd: nativeDir,
                env: {
                    ...process.env,
                    GDK_BACKEND: "wayland",
                    GSK_RENDERER: "cairo",
                    LIBGL_ALWAYS_SOFTWARE: "1",
                    GDK_DISABLE: "vulkan",
                    RUSTUP_TOOLCHAIN: "nightly",
                    RUSTFLAGS: "-Zsanitizer=address",
                    ASAN_OPTIONS: "detect_leaks=0:abort_on_error=1:detect_stack_use_after_return=1",
                },
            },
        );
    },
    miri() {
        run("cargo", ["+nightly", "miri", "test", "--test", "miri_marshalling"], {
            cwd: nativeDir,
            env: { ...process.env, RUSTUP_TOOLCHAIN: "nightly" },
        });
    },
    bench() {
        const profileFolder = process.env.CODSPEED_PROFILE_FOLDER ?? "/tmp/codspeed-profile";
        mkdirSync(profileFolder, { recursive: true });
        run("codspeed", ["run", "-m", "simulation", "--", "node", selfPath, "bench:measured"], {
            env: { ...process.env, CODSPEED_PROFILE_FOLDER: profileFolder },
        });
    },
    "bench:measured"() {
        run("cargo", ["codspeed", "run"], { cwd: nativeDir });
        run("wlheadless-run", ["-c", "weston", "--", "pnpm", "--filter", "@gtkx/e2e", "bench"], {
            env: {
                ...process.env,
                GDK_BACKEND: "wayland",
                GSK_RENDERER: "cairo",
                LIBGL_ALWAYS_SOFTWARE: "1",
                GDK_DISABLE: "vulkan",
                PATH: `/opt/node22/bin:${process.env.PATH ?? ""}`,
            },
        });
    },
};

const task = process.argv[2];
const handler = task ? tasks[task] : undefined;
if (!handler) {
    console.error(`Unknown CI task: ${task ?? "(none)"}. Expected one of: ${Object.keys(tasks).join(", ")}`);
    process.exit(1);
}
handler();
