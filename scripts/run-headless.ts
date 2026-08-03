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

const waitForExit = (child: ChildProcess): Promise<number> =>
    new Promise((resolve) => {
        child.on("exit", (code, signal) => {
            resolve(code ?? exitCodeForSignal(signal));
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

    const child = spawnWithParentDeathSignal("wlheadless-run", ["-c", "weston", "--", command, ...args], {
        stdio: "inherit",
        env: {
            ...process.env,
            ...(requiresNightly && { RUSTUP_TOOLCHAIN: RUST_NIGHTLY }),
            ...HEADLESS_ENV,
        },
    });

    process.exitCode = await waitForExit(child);
};

await runHeadless();
