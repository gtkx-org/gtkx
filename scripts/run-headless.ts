import type { ChildProcess } from "node:child_process";
import { exitCodeForSignal, spawnWithParentDeathSignal } from "@gtkx/utils";
import { RUST_NIGHTLY } from "./rust-nightly.js";

const HEADLESS_ENV = {
    GDK_BACKEND: "wayland",
    GSK_RENDERER: "cairo",
    GDK_DEBUG: "no-vsync",
    LIBGL_ALWAYS_SOFTWARE: "1",
    GDK_DISABLE: "vulkan",
    ALSOFT_DRIVERS: "null",
    ALSOFT_LOGLEVEL: "0",
};

const spawnInOwnProcessGroup = (command: string, args: string[], env: NodeJS.ProcessEnv): ChildProcess =>
    spawnWithParentDeathSignal("timeout", ["--preserve-status", "0", command, ...args], {
        stdio: "inherit",
        env,
    });

const waitForExit = (child: ChildProcess): Promise<number> =>
    new Promise((resolve) => {
        child.once("exit", (code, signal) => {
            resolve(code ?? exitCodeForSignal(signal));
        });

        child.once("error", (error) => {
            console.error(error);
            resolve(1);
        });
    });

const runHeadless = async (): Promise<void> => {
    const command = process.argv[2];

    if (!command) {
        console.error("Usage: tsx ./scripts/run-headless.ts <command> [args...]");
        process.exitCode = 1;

        return;
    }

    const rawArgs = process.argv.slice(3);
    const requiresNightly = rawArgs.includes("+nightly");
    const args = rawArgs.filter((arg) => arg !== "+nightly");

    const child = spawnInOwnProcessGroup("wlheadless-run", ["-c", "weston", "--", command, ...args], {
        ...process.env,
        ...(requiresNightly && { RUSTUP_TOOLCHAIN: RUST_NIGHTLY }),
        ...HEADLESS_ENV,
    });

    process.exitCode = await waitForExit(child);
};

await runHeadless();
