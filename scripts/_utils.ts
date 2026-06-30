import { spawn, spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const REPO_ROOT: string = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const HEADLESS_RENDER_ENV = {
    GDK_BACKEND: "wayland",
    GSK_RENDERER: "cairo",
    LIBGL_ALWAYS_SOFTWARE: "1",
    GDK_DISABLE: "vulkan",
    ALSOFT_DRIVERS: "null",
    ALSOFT_LOGLEVEL: "0",
};

interface RunOptions {
    cwd?: string | undefined;
    env?: NodeJS.ProcessEnv;
}

export function runHeadless(command: string, args: string[], options: RunOptions = {}): void {
    return run("wlheadless-run", ["-c", "weston", "--", command, ...args], {
        cwd: options.cwd,
        env: { ...process.env, ...HEADLESS_RENDER_ENV, ...options.env },
    });
}

export function run(command: string, args: string[], options: RunOptions = {}): void {
    const result = spawnSync(command, args, {
        cwd: options.cwd ?? REPO_ROOT,
        env: options.env ?? process.env,
        stdio: "inherit",
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

export function runAsync(command: string, args: string[], options: RunOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: "inherit" });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code ?? "unknown"}: ${command} ${args.join(" ")}`));
            }
        });
    });
}
