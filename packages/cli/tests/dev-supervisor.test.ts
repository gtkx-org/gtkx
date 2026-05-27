import type { ChildProcess } from "node:child_process";
import { fork } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
    fork: vi.fn(),
}));

import { RELOAD_EXIT_CODE } from "../src/dev-protocol.js";
import { runDevSupervisor } from "../src/dev-supervisor.js";

const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const forkMock = vi.mocked(fork);

type FakeChild = EventEmitter & { killed: boolean; kill: ReturnType<typeof vi.fn> };

function createFakeChild(): FakeChild {
    const child = new EventEmitter() as FakeChild;
    child.killed = false;
    child.kill = vi.fn((_signal?: NodeJS.Signals) => {
        child.killed = true;
        return true;
    });
    return child;
}

type SupervisorContext = {
    logSpy: ReturnType<typeof vi.spyOn>;
    exitSpy: ReturnType<typeof vi.spyOn>;
    prevSigInt: NodeJS.Signals[] | undefined;
    prevSigTerm: NodeJS.Signals[] | undefined;
    prevSigHup: NodeJS.Signals[] | undefined;
};

const cleanupSignalListeners = (
    name: "SIGINT" | "SIGTERM" | "SIGHUP",
    previous: NodeJS.Signals[] | undefined,
): void => {
    const current = process.listeners(name) as unknown as NodeJS.Signals[];
    for (const listener of current) {
        if (!previous?.includes(listener)) {
            process.removeListener(name, listener as never);
        }
    }
};

const setupSupervisorCtx = (): SupervisorContext => {
    const ctx = {} as SupervisorContext;
    beforeEach(() => {
        vi.clearAllMocks();
        ctx.logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        ctx.exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        ctx.prevSigInt = process.listeners("SIGINT") as unknown as NodeJS.Signals[];
        ctx.prevSigTerm = process.listeners("SIGTERM") as unknown as NodeJS.Signals[];
        ctx.prevSigHup = process.listeners("SIGHUP") as unknown as NodeJS.Signals[];
    });
    afterEach(() => {
        ctx.logSpy.mockRestore();
        ctx.exitSpy.mockRestore();
        cleanupSignalListeners("SIGINT", ctx.prevSigInt);
        cleanupSignalListeners("SIGTERM", ctx.prevSigTerm);
        cleanupSignalListeners("SIGHUP", ctx.prevSigHup);
    });
    return ctx;
};

const startSupervisor = async (entry = "/abs/src/main.tsx"): Promise<FakeChild> => {
    const child = createFakeChild();
    forkMock.mockReturnValueOnce(child as unknown as ChildProcess);
    runDevSupervisor(entry).catch(() => undefined);
    await Promise.resolve();
    return child;
};

describe("runDevSupervisor (startup)", () => {
    setupSupervisorCtx();

    it("forks the dev runner with the supplied entry", async () => {
        await startSupervisor("/abs/src/main.tsx");

        expect(forkMock).toHaveBeenCalledOnce();
        const [, args] = forkMock.mock.calls[0] ?? [];
        expect(Array.isArray(args) ? args[0] : undefined).toBe("/abs/src/main.tsx");
    });
});

describe("runDevSupervisor (child exit handling)", () => {
    const ctx = setupSupervisorCtx();

    it("relaunches the runner when the child exits with the reload code", async () => {
        const child = await startSupervisor();
        const second = createFakeChild();
        forkMock.mockReturnValueOnce(second as unknown as ChildProcess);

        child.emit("exit", RELOAD_EXIT_CODE, null);

        expect(forkMock).toHaveBeenCalledTimes(2);
        expect(ctx.exitSpy).not.toHaveBeenCalled();
        const logged = ctx.logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
        expect(logged).toContain("Restarting dev runner");
    });

    it("exits with the child's code when the child exits non-reloadably", async () => {
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

    it("exits with the canonical signal code when no child is alive", async () => {
        const child = await startSupervisor();
        child.emit("exit", 0, null);
        ctx.exitSpy.mockClear();

        process.emit("SIGINT", "SIGINT");
        await flushMicrotasks();

        expect(ctx.exitSpy).toHaveBeenCalledWith(130);
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
        (child as unknown as { pid: number }).pid = 12345;
        (child as unknown as { exitCode: number | null }).exitCode = null;

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
