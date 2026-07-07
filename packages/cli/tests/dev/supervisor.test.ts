import { EventEmitter } from "node:events";
import type { FSWatcher } from "node:fs";
import { watch as watchFs } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importActual) => {
    const actual = await importActual<typeof import("node:fs")>();
    return { ...actual, watch: vi.fn() };
});

import {
    type ForkRunner,
    RESTART_EXIT_CODE,
    runDevSupervisor,
    type SupervisedChild,
} from "../../src/dev/supervisor.js";

const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const watchMock = vi.mocked(watchFs);

type FakeChild = SupervisedChild &
    EventEmitter & {
        killed: boolean;
        pid: number | undefined;
        exitCode: number | null;
        kill: ReturnType<typeof vi.fn<(signal?: number | NodeJS.Signals) => boolean>>;
    };

function createFakeChild(): FakeChild {
    const child: FakeChild = Object.assign(new EventEmitter(), {
        killed: false,
        pid: undefined as number | undefined,
        exitCode: null as number | null,
        kill: vi.fn<(signal?: number | NodeJS.Signals) => boolean>((_signal) => {
            child.killed = true;
            return true;
        }),
    });
    return child;
}

const forkMock = vi.fn<ForkRunner>();

const TEST_CWD = "/proj";

const startWithForkMock = (entry: string, watch?: Parameters<typeof runDevSupervisor>[2]): void => {
    runDevSupervisor(entry, TEST_CWD, watch, forkMock).catch(() => undefined);
};

function queueChild(): FakeChild {
    const child = createFakeChild();
    forkMock.mockReturnValueOnce(child);
    return child;
}

function createFakeWatcher(): FSWatcher {
    const watcher: FSWatcher = Object.assign(new EventEmitter(), {
        close(): void {},
        ref(): FSWatcher {
            return watcher;
        },
        unref(): FSWatcher {
            return watcher;
        },
        [Symbol.dispose](): void {},
    });
    return watcher;
}

function captureConfigWatcher(): { fireConfigChange: () => void } {
    let fire: () => void = () => {};
    watchMock.mockImplementationOnce((_path, listener) => {
        fire = () => listener?.("change", "gtkx.config.ts");
        return createFakeWatcher();
    });
    return { fireConfigChange: () => fire() };
}

type SignalListener = NodeJS.SignalsListener;

type SupervisorContext = {
    stderrSpy: ReturnType<typeof vi.spyOn>;
    exitSpy: ReturnType<typeof vi.spyOn>;
    prevSigInt: SignalListener[] | undefined;
    prevSigTerm: SignalListener[] | undefined;
    prevSigHup: SignalListener[] | undefined;
};

const cleanupSignalListeners = (
    name: "SIGINT" | "SIGTERM" | "SIGHUP",
    previous: SignalListener[] | undefined,
): void => {
    const current = process.listeners(name);
    for (const listener of current) {
        if (!previous?.includes(listener)) {
            process.removeListener(name, listener);
        }
    }
};

const setupSupervisorCtx = (): SupervisorContext => {
    const ctx = {} as SupervisorContext;
    beforeEach(() => {
        vi.clearAllMocks();
        ctx.stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        ctx.exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        ctx.prevSigInt = process.listeners("SIGINT");
        ctx.prevSigTerm = process.listeners("SIGTERM");
        ctx.prevSigHup = process.listeners("SIGHUP");
    });
    afterEach(() => {
        ctx.stderrSpy.mockRestore();
        ctx.exitSpy.mockRestore();
        cleanupSignalListeners("SIGINT", ctx.prevSigInt);
        cleanupSignalListeners("SIGTERM", ctx.prevSigTerm);
        cleanupSignalListeners("SIGHUP", ctx.prevSigHup);
    });
    return ctx;
};

const startSupervisor = async (entry = "/abs/src/main.tsx"): Promise<FakeChild> => {
    const child = queueChild();
    startWithForkMock(entry);
    await Promise.resolve();
    return child;
};

describe("runDevSupervisor (startup)", () => {
    setupSupervisorCtx();

    it("forks the dev runner with the supplied entry and project cwd", async () => {
        await startSupervisor("/abs/src/main.tsx");

        expect(forkMock).toHaveBeenCalledOnce();
        const [, args, cwd] = forkMock.mock.calls[0] ?? [];
        expect(Array.isArray(args) ? args[0] : undefined).toBe("/abs/src/main.tsx");
        expect(cwd).toBe(TEST_CWD);
    });
});

describe("runDevSupervisor (child exit handling)", () => {
    const ctx = setupSupervisorCtx();

    it("relaunches the runner when the child exits with the restart code", async () => {
        const child = await startSupervisor();
        queueChild();

        child.emit("exit", RESTART_EXIT_CODE, null);

        expect(forkMock).toHaveBeenCalledTimes(2);
        expect(ctx.exitSpy).not.toHaveBeenCalled();
        const logged = ctx.stderrSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("");
        expect(logged).toContain("Restarting dev runner");
    });

    it("exits with the child's code when the child exits non-restartably", async () => {
        const child = await startSupervisor();

        child.emit("exit", 7, null);

        expect(ctx.exitSpy).toHaveBeenCalledWith(7);
    });

    it("exits with the signal-mapped code when the child exits via signal", async () => {
        const child = await startSupervisor();

        child.emit("exit", null, "SIGINT");

        expect(ctx.exitSpy).toHaveBeenCalledWith(130);
    });
});

describe("runDevSupervisor (signal forwarding — per-signal)", () => {
    const ctx = setupSupervisorCtx();

    it("forwards SIGINT to the running child process", async () => {
        const child = await startSupervisor();

        process.emit("SIGINT", "SIGINT");
        await flushMicrotasks();

        expect(child.kill).toHaveBeenCalledWith("SIGINT");
        expect(ctx.exitSpy).not.toHaveBeenCalled();
    });

    it("forwards SIGTERM to the running child process", async () => {
        const child = await startSupervisor();

        process.emit("SIGTERM", "SIGTERM");
        await flushMicrotasks();

        expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("forwards SIGHUP to the running child process", async () => {
        const child = await startSupervisor();

        process.emit("SIGHUP", "SIGHUP");
        await flushMicrotasks();

        expect(child.kill).toHaveBeenCalledWith("SIGHUP");
    });
});

describe("runDevSupervisor (signal forwarding — exit propagation)", () => {
    const ctx = setupSupervisorCtx();

    it("exits 0 when the child shuts down cleanly on SIGINT", async () => {
        const child = await startSupervisor();

        process.emit("SIGINT", "SIGINT");
        await flushMicrotasks();
        child.emit("exit", 0, null);
        await flushMicrotasks();

        expect(ctx.exitSpy).toHaveBeenCalledWith(0);
    });

    it("propagates the child's exit code through the shutdown helper", async () => {
        const child = await startSupervisor();

        process.emit("SIGINT", "SIGINT");
        await flushMicrotasks();
        child.emit("exit", 7, null);
        await flushMicrotasks();

        expect(ctx.exitSpy).toHaveBeenCalledWith(7);
    });

    it("does not re-kill a child that already reports killed=true", async () => {
        const child = await startSupervisor();
        child.killed = true;

        process.emit("SIGINT", "SIGINT");
        await flushMicrotasks();

        expect(child.kill).not.toHaveBeenCalled();
    });

    it("exits 0 on a clean shutdown when no child is alive", async () => {
        const child = await startSupervisor();
        child.emit("exit", 0, null);
        ctx.exitSpy.mockClear();

        process.emit("SIGINT", "SIGINT");
        await flushMicrotasks();

        expect(ctx.exitSpy).toHaveBeenCalledWith(0);
    });

    it("falls back to exitCodeForSignal when the child exits via signal during shutdown", async () => {
        const child = await startSupervisor();

        process.emit("SIGTERM", "SIGTERM");
        await flushMicrotasks();
        child.emit("exit", null, "SIGTERM");
        await flushMicrotasks();

        expect(ctx.exitSpy).toHaveBeenCalledWith(143);
    });
});

describe("runDevSupervisor (signal forwarding — shutdown ordering)", () => {
    const ctx = setupSupervisorCtx();

    it("ignores subsequent child exits once shutting down", async () => {
        const child = await startSupervisor();

        process.emit("SIGINT", "SIGINT");
        await flushMicrotasks();
        ctx.exitSpy.mockClear();

        child.emit("exit", 99, null);

        expect(ctx.exitSpy).not.toHaveBeenCalledWith(99);
    });
});

describe("runDevSupervisor (signal forwarding — force kill)", () => {
    setupSupervisorCtx();

    it("force-kills the child via SIGKILL on a second SIGINT", async () => {
        const processKillSpy = vi.spyOn(process, "kill").mockImplementation((() => true) as never);
        const child = await startSupervisor();
        child.pid = 12345;
        child.exitCode = null;

        process.emit("SIGINT", "SIGINT");
        await flushMicrotasks();
        child.killed = false;
        process.emit("SIGINT", "SIGINT");
        await flushMicrotasks();

        const kills = processKillSpy.mock.calls.filter((args) => args[1] === "SIGKILL");
        expect(kills.length).toBeGreaterThanOrEqual(1);
        processKillSpy.mockRestore();
    });
});

describe("runDevSupervisor (config watch)", () => {
    const ctx = setupSupervisorCtx();

    const startWithWatch = async (
        regenerate: () => Promise<void>,
    ): Promise<{ child: FakeChild; fireConfigChange: () => void }> => {
        const child = queueChild();
        const { fireConfigChange } = captureConfigWatcher();
        startWithForkMock("/proj/src/index.tsx", {
            paths: ["/proj/gtkx.config.ts"],
            regenerate,
        });
        await Promise.resolve();
        return { child, fireConfigChange };
    };

    it("regenerates and restarts the runner when the config changes", async () => {
        const regenerate = vi.fn(async () => {});
        const { child, fireConfigChange } = await startWithWatch(regenerate);
        queueChild();

        fireConfigChange();
        await new Promise((resolve) => setTimeout(resolve, 250));

        expect(regenerate).toHaveBeenCalledOnce();
        expect(child.kill).toHaveBeenCalledWith("SIGTERM");

        child.emit("exit", null, "SIGTERM");
        await flushMicrotasks();

        expect(forkMock).toHaveBeenCalledTimes(2);
        expect(ctx.exitSpy).not.toHaveBeenCalled();
    });

    it("keeps the current runner when regeneration fails", async () => {
        const regenerate = vi.fn(async () => {
            throw new Error("bad config");
        });
        const { child, fireConfigChange } = await startWithWatch(regenerate);

        fireConfigChange();
        await new Promise((resolve) => setTimeout(resolve, 250));

        expect(regenerate).toHaveBeenCalledOnce();
        expect(child.kill).not.toHaveBeenCalled();
        expect(forkMock).toHaveBeenCalledOnce();
    });
});
