import { type ChildProcess, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const cliBin = join(dirname(require.resolve("@gtkx/cli/package.json")), "bin", "gtkx.js");

const BOOT_TIMEOUT_MS = 90_000;
const MOUNTED = /Connected application id|HMR enabled/;
const PIPELINE_ERROR = /\[gtkx(?::[^\]]+)?\] (?:Fatal:|error |warn )|\[vite\][^\n]*\bError\b|\bERR_[A-Z_]+\b/;

const killTree = (child: ChildProcess): void => {
    if (child.pid === undefined) return;
    try {
        process.kill(-child.pid, "SIGKILL");
    } catch {}
};

describe("gtkx dev", () => {
    it(
        "boots the real SSR dev pipeline against an app that pulls @gtkx/components",
        async () => {
            const child = spawn(process.execPath, [cliBin, "dev"], {
                cwd: projectRoot,
                detached: true,
                stdio: ["ignore", "pipe", "pipe"],
                env: process.env,
            });

            let transcript = "";
            const booted = new Promise<void>((resolve, reject) => {
                const observe = (chunk: Buffer): void => {
                    transcript += chunk.toString();
                    if (PIPELINE_ERROR.test(transcript)) reject(new Error(transcript));
                    else if (MOUNTED.test(transcript)) resolve();
                };
                child.stdout.on("data", observe);
                child.stderr.on("data", observe);
                child.once("error", reject);
                child.once("exit", (code, signal) =>
                    reject(new Error(`dev exited before mounting (code=${code} signal=${signal})\n${transcript}`)),
                );
            });

            const timeout = new Promise<never>((_, reject) => {
                setTimeout(
                    () => reject(new Error(`dev did not mount within ${BOOT_TIMEOUT_MS}ms\n${transcript}`)),
                    BOOT_TIMEOUT_MS,
                );
            });

            try {
                await Promise.race([booted, timeout]);
                expect(transcript).not.toMatch(PIPELINE_ERROR);
            } finally {
                killTree(child);
            }
        },
        BOOT_TIMEOUT_MS + 10_000,
    );
});
