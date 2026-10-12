import { spawn } from "node:child_process";
import { captureProcessGroupOwner, readProcessIdentity, readProcessStatus, watchProcessGroupOwner } from "@gtkx/utils";

const role = process.argv[2];
const mode = process.argv[3] ?? "native";

if (role === "owner") {
    const owner = readProcessIdentity(process.pid);
    if (owner === undefined) {
        throw new Error("Cannot identify fixture owner");
    }
    const parent = spawn(process.execPath, [...process.execArgv, import.meta.filename, "parent", mode, JSON.stringify(owner)], {
        stdio: ["ignore", "inherit", "inherit"],
    });
    parent.on("error", (error) => { throw error; });
    setInterval(() => undefined, 1000);
} else if (role === "parent") {
    const child = spawn(process.execPath, [...process.execArgv, import.meta.filename, "target", mode, process.argv[4] ?? ""], {
        stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("error", (error) => { throw error; });
    child.on("exit", (code, signal) => {
        process.stdout.write(`TARGET EXITED ${String(code)} ${String(signal)} PARENT ALIVE\n`);
    });
} else {
    const owner = JSON.parse(process.argv[4] ?? "null") as { pid: number; startTime: string };
    const { armParentDeath, keepAlive } = await import("@gtkx/runtime/internal");
    const captured = captureProcessGroupOwner(process.pid, process.ppid);
    if (captured?.pid !== owner.pid || captured.startTime !== owner.startTime) {
        throw new Error("Captured a different fixture process owner");
    }
    let closed: (() => void) | undefined;
    let armed: boolean;
    if (mode.startsWith("race")) {
        const { activateProcessWatch, closeProcessWatch, openProcessWatch } = await import("@gtkx/native");
        const killOwner = (): void => {
            process.kill(owner.pid, "SIGKILL");
            const deadline = Date.now() + 5000;
            while (readProcessStatus(owner.pid) !== undefined) {
                if (Date.now() > deadline) {
                    throw new Error("Owner failed to die during arming race");
                }
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
            }
        };
        closed = watchProcessGroupOwner(owner, {
            open: (pid) => {
                if (mode === "race-before-open") {
                    killOwner();
                }
                const watch = openProcessWatch(pid) ?? undefined;
                if (mode === "race-open") {
                    killOwner();
                }
                return watch;
            },
            activate: (watch) => {
                if (mode === "race-activate") {
                    killOwner();
                }
                return activateProcessWatch(watch);
            },
            close: closeProcessWatch,
        });
        armed = closed !== undefined;
    } else if (mode === "open-error") {
        const { activateProcessWatch, closeProcessWatch, openProcessWatch } = await import("@gtkx/native");
        let reported = false;
        try {
            watchProcessGroupOwner(owner, {
                open: () => openProcessWatch(0) ?? undefined,
                activate: activateProcessWatch,
                close: closeProcessWatch,
            });
        } catch (error) {
            if (!(error instanceof Error) || readProcessIdentity(owner.pid)?.startTime !== owner.startTime) {
                throw new Error("Owner disappeared during native open failure", { cause: error });
            }
            process.stdout.write("LIVE OWNER OPEN ERROR\n");
            reported = true;
        }
        if (!reported) {
            throw new Error("Native open failure was hidden");
        }
        armed = false;
    } else if (mode.startsWith("fallback")) {
        if (!armParentDeath(process.ppid)) {
            throw new Error("Fixture parent died");
        }
        closed = watchProcessGroupOwner(owner, {
            open: () => undefined,
            activate: () => { throw new Error("Fallback activated a native monitor"); },
            close: () => { throw new Error("Fallback closed a native monitor"); },
        });
        armed = closed !== undefined;
    } else {
        armed = armParentDeath(process.ppid, owner.pid, mode === "wrong-start" ? "0" : owner.startTime);
    }
    if (mode === "wrong-start" || mode === "open-error" || mode.startsWith("race")) {
        process.stdout.write(`INVALID OWNER ${String(armed)}\n`);
    } else {
        if (!armed) {
            throw new Error("Owner exited before fixture armed");
        }
        keepAlive(true);
        process.stdout.write(`TARGET ARMED ${String(process.pid)}\n`);
        if (mode === "fallback-count") {
            let signals = 0;
            process.removeAllListeners("SIGTERM");
            process.on("SIGTERM", () => {
                signals++;
                if (signals === 1) {
                    setTimeout(() => {
                        process.stdout.write(`FALLBACK SIGNALS ${String(signals)}\n`);
                        process.exit(0);
                    }, 200);
                }
            });
            process.kill(owner.pid, "SIGKILL");
        }
        if (mode === "fallback-cancel") {
            closed?.();
            process.kill(owner.pid, "SIGKILL");
            setTimeout(() => {
                process.stdout.write("CANCELLED TARGET SURVIVED\n");
                process.exit(0);
            }, 150);
        }
        if (mode.endsWith("blocked")) {
            process.removeAllListeners("SIGTERM");
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
        }
    }
    process.on("exit", () => { closed?.(); });
}
