import { spawnSync } from "node:child_process";

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) {
    console.error("Usage: tsx ./scripts/run-headless.ts <command> [args...]");
    process.exit(1);
}

const result = spawnSync("wlheadless-run", ["-c", "weston", "--", command, ...args], {
    env: {
        ...process.env,
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
    process.exit(result.status ?? 1);
}
