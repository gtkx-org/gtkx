import { resolveExecutable } from "@gtkx/utils";
import { spawnSync } from "node:child_process";

const RUST_NIGHTLY = "nightly-2026-07-26";

const runHeadless = (): void => {
    const command = process.argv[2];

    if (!command) {
        console.error("Usage: tsx ./scripts/run-headless.ts <command> [args...]");
        process.exitCode = 1;

        return;
    }

    const rawArgs = process.argv.slice(3);
    const requiresNightly = rawArgs.includes("+nightly");
    const args = rawArgs.filter((arg) => arg !== "+nightly");

    const result = spawnSync(resolveExecutable("wlheadless-run"), ["-c", "weston", "--", command, ...args], {
        env: {
            ...process.env,
            ...(requiresNightly && { RUSTUP_TOOLCHAIN: RUST_NIGHTLY }),
            GDK_BACKEND: "wayland",
            GSK_RENDERER: "cairo",
            GDK_DEBUG: "no-vsync",
            LIBGL_ALWAYS_SOFTWARE: "1",
            GDK_DISABLE: "vulkan",
            ALSOFT_DRIVERS: "null",
            ALSOFT_LOGLEVEL: "0",
        },
        stdio: "inherit",
    });

    if (result.status !== 0) {
        process.exitCode = result.status ?? 1;
    }
};

runHeadless();
