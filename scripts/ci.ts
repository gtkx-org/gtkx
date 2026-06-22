#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HEADLESS_RENDER_ENV, wlheadless } from "./headless.ts";

const selfPath = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(selfPath));
const nativeDir = join(repoRoot, "packages", "native");

interface RunOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}

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
        const [command, args] = wlheadless("cargo", [
            "+nightly",
            "test",
            "--features",
            "test-support",
            "--target",
            "x86_64-unknown-linux-gnu",
            "--",
            "--test-threads=1",
        ]);
        run(command, args, {
            cwd: nativeDir,
            env: {
                ...process.env,
                ...HEADLESS_RENDER_ENV,
                RUSTUP_TOOLCHAIN: "nightly",
                RUSTFLAGS: "-Zsanitizer=address",
                ASAN_OPTIONS: "detect_leaks=0:abort_on_error=1:detect_stack_use_after_return=1",
            },
        });
    },
    miri() {
        run("cargo", ["+nightly", "miri", "test", "--features", "test-support", "--test", "miri_marshalling"], {
            cwd: nativeDir,
            env: { ...process.env, RUSTUP_TOOLCHAIN: "nightly" },
        });
    },
    bench() {
        const profileFolder = process.env["CODSPEED_PROFILE_FOLDER"] ?? "/tmp/codspeed-profile";
        mkdirSync(profileFolder, { recursive: true });
        run("codspeed", ["run", "-m", "simulation", "--", "node", selfPath, "bench:measured"], {
            env: { ...process.env, CODSPEED_PROFILE_FOLDER: profileFolder },
        });
    },
    "bench:measured"() {
        run("cargo", ["codspeed", "run"], { cwd: nativeDir });
        const [command, args] = wlheadless("pnpm", ["--filter", "@gtkx/e2e", "bench"]);
        run(command, args, {
            env: {
                ...process.env,
                ...HEADLESS_RENDER_ENV,
                PATH: `/opt/node22/bin:${process.env["PATH"] ?? ""}`,
            },
        });
    },
    headless() {
        const [forwarded, ...rest] = process.argv.slice(3);
        if (!forwarded) {
            console.error("Usage: ci.ts headless <command> [args...]");
            process.exit(1);
        }
        const [command, args] = wlheadless(forwarded, rest);
        run(command, args, {
            cwd: nativeDir,
            env: { ...process.env, ...HEADLESS_RENDER_ENV },
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
