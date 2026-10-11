import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { collectOutput, waitForMarker } from "./helpers/child-output.js";

test("losing the owner shuts down the child runtime", async () => {
    const fixture = fileURLToPath(new URL("./fixtures/parent-death.ts", import.meta.url));
    const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
    const owner = spawn(process.execPath, ["--import", loader, fixture, "owner"], {
        stdio: ["ignore", "pipe", "pipe"],
    });
    const read = collectOutput(owner);
    const closed = new Promise<void>((resolve) => {
        owner.once("close", () => resolve());
    });

    try {
        await waitForMarker({
            child: owner,
            read,
            marker: "CHILD ARMED",
            subject: "parent death fixture",
            timeoutMs: 10_000,
        });
        owner.kill("SIGKILL");
        await closed;
        expect(read()).toContain("CHILD EXITED");
    } finally {
        owner.kill("SIGKILL");
    }
}, 15_000);

for (const mode of ["native", "native-blocked", "fallback", "fallback-blocked"]) {
    test(`ancestor owner death reaches the child with ${mode} monitoring`, async () => {
        const fixture = fileURLToPath(new URL("./fixtures/process-owner.ts", import.meta.url));
        const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
        const owner = spawn(process.execPath, ["--import", loader, fixture, "owner", mode], {
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const read = collectOutput(owner);
        try {
            await waitForMarker({ child: owner, read, marker: "TARGET ARMED", subject: mode, timeoutMs: 10_000 });
            owner.kill("SIGSTOP");
            await new Promise((resolve) => setTimeout(resolve, 150));
            expect(read()).not.toContain("TARGET EXITED");
            owner.kill("SIGKILL");
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`Descendants did not exit: ${read()}`)), 10_000);
                owner.once("close", () => {
                    clearTimeout(timer);
                    resolve();
                });
            });
            expect(read()).toContain("PARENT ALIVE");
            expect(read()).toContain(mode.endsWith("blocked") ? "TARGET EXITED null SIGTERM" : "PARENT ALIVE");
        } finally {
            if (owner.pid !== undefined) {
                try {
                    process.kill(-owner.pid, "SIGKILL");
                } catch {
                    owner.kill("SIGKILL");
                }
            }
        }
    }, 15_000);
}

test("a captured owner with the wrong start time is rejected", async () => {
    const fixture = fileURLToPath(new URL("./fixtures/process-owner.ts", import.meta.url));
    const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
    const owner = spawn(process.execPath, ["--import", loader, fixture, "owner", "wrong-start"], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const read = collectOutput(owner);
    try {
        await waitForMarker({
            child: owner,
            read,
            marker: "INVALID OWNER false",
            subject: "wrong owner identity",
            timeoutMs: 10_000,
        });
        expect(read()).toContain("INVALID OWNER false");
    } finally {
        if (owner.pid !== undefined) {
            process.kill(-owner.pid, "SIGKILL");
        }
    }
}, 15_000);

for (const mode of ["close", "worker"]) {
    test(`${mode} cleanup releases process watch descriptors`, async () => {
        const fixture = fileURLToPath(new URL("./fixtures/process-watch.ts", import.meta.url));
        const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
        const child = spawn(process.execPath, ["--import", loader, fixture, mode], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        const read = collectOutput(child);
        const code = await new Promise<number | null>((resolve) => {
            child.once("close", resolve);
        });
        expect(code).toBe(0);
        const result = JSON.parse(read()) as {
            before: number;
            after: number;
            opened?: boolean;
            unrelated?: boolean;
            wrongParent?: boolean;
        };
        expect(result.after).toBeLessThanOrEqual(result.before + (mode === "worker" ? 2 : 0));
        expect(result).toMatchObject(mode === "close" ? { opened: false, unrelated: false, wrongParent: false } : {});
    }, 15_000);
}

for (const mode of ["race-before-open", "race-open", "race-activate"]) {
    test(`owner death during ${mode} rejects activation`, async () => {
        const fixture = fileURLToPath(new URL("./fixtures/process-owner.ts", import.meta.url));
        const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
        const owner = spawn(process.execPath, ["--import", loader, fixture, "owner", mode], {
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const read = collectOutput(owner);
        try {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`Arming race did not finish: ${read()}`)), 10_000);
                owner.once("close", () => {
                    clearTimeout(timer);
                    resolve();
                });
            });
            expect(read()).toContain("INVALID OWNER false");
            expect(read()).toContain("PARENT ALIVE");
        } finally {
            if (owner.pid !== undefined) {
                try {
                    process.kill(-owner.pid, "SIGKILL");
                } catch {
                    owner.kill("SIGKILL");
                }
            }
        }
    }, 15_000);
}

test("an already exited zombie cannot activate a pidfd watch", async () => {
    const fixture = fileURLToPath(new URL("./fixtures/process-watch.ts", import.meta.url));
    const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
    const child = spawn(process.execPath, ["--import", loader, fixture, "zombie"], {
        stdio: ["ignore", "pipe", "pipe"],
    });
    const read = collectOutput(child);
    const code = await new Promise<number | null>((resolve) => {
        child.once("close", resolve);
    });
    expect(code).toBe(0);
    expect(JSON.parse(read())).toEqual({ activated: false });
}, 15_000);

test("closing a fallback watch prevents signals after owner death", async () => {
    const fixture = fileURLToPath(new URL("./fixtures/process-owner.ts", import.meta.url));
    const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
    const owner = spawn(process.execPath, ["--import", loader, fixture, "owner", "fallback-cancel"], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const read = collectOutput(owner);
    try {
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Cancellation did not finish: ${read()}`)), 10_000);
            owner.once("close", () => {
                clearTimeout(timer);
                resolve();
            });
        });
        expect(read()).toContain("CANCELLED TARGET SURVIVED");
        expect(read()).toContain("TARGET EXITED 0 null");
    } finally {
        if (owner.pid !== undefined) {
            try {
                process.kill(-owner.pid, "SIGKILL");
            } catch {
                owner.kill("SIGKILL");
            }
        }
    }
}, 15_000);

test("fallback owner death delivers exactly one termination signal", async () => {
    const fixture = fileURLToPath(new URL("./fixtures/process-owner.ts", import.meta.url));
    const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
    const owner = spawn(process.execPath, ["--import", loader, fixture, "owner", "fallback-count"], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const read = collectOutput(owner);
    try {
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Signal count did not finish: ${read()}`)), 10_000);
            owner.once("close", () => {
                clearTimeout(timer);
                resolve();
            });
        });
        expect(read()).toContain("FALLBACK SIGNALS 1");
        expect(read()).toContain("TARGET EXITED 0 null");
    } finally {
        if (owner.pid !== undefined) {
            try {
                process.kill(-owner.pid, "SIGKILL");
            } catch {
                owner.kill("SIGKILL");
            }
        }
    }
}, 15_000);

test("native open failures remain visible while the owner is alive", async () => {
    const fixture = fileURLToPath(new URL("./fixtures/process-owner.ts", import.meta.url));
    const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
    const owner = spawn(process.execPath, ["--import", loader, fixture, "owner", "open-error"], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const read = collectOutput(owner);
    try {
        await waitForMarker({
            child: owner,
            read,
            marker: "LIVE OWNER OPEN ERROR",
            subject: "native watch open failure",
            timeoutMs: 10_000,
        });
        expect(read()).toContain("LIVE OWNER OPEN ERROR");
    } finally {
        if (owner.pid !== undefined) {
            try {
                process.kill(-owner.pid, "SIGKILL");
            } catch {
                owner.kill("SIGKILL");
            }
        }
    }
}, 15_000);
