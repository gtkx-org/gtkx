import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exitCodeForSignal, installGracefulShutdown } from "../src/graceful-shutdown.js";

describe("exitCodeForSignal", () => {
    it("returns 0 when no signal", () => {
        expect(exitCodeForSignal(null)).toBe(0);
    });

    it("returns 130 for SIGINT", () => {
        expect(exitCodeForSignal("SIGINT")).toBe(130);
    });

    it("returns 143 for SIGTERM", () => {
        expect(exitCodeForSignal("SIGTERM")).toBe(143);
    });

    it("returns 143 for any other signal", () => {
        expect(exitCodeForSignal("SIGHUP")).toBe(143);
    });
});

const HANDLED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

type Snapshot = Record<(typeof HANDLED_SIGNALS)[number], NodeJS.SignalsListener[]>;

const snapshotListeners = (): Snapshot => {
    const snap = {} as Snapshot;
    for (const sig of HANDLED_SIGNALS) {
        snap[sig] = process.listeners(sig) as NodeJS.SignalsListener[];
    }
    return snap;
};

const restoreListeners = (snap: Snapshot): void => {
    for (const sig of HANDLED_SIGNALS) {
        for (const listener of process.listeners(sig)) {
            if (!snap[sig].includes(listener as NodeJS.SignalsListener)) {
                process.removeListener(sig, listener as NodeJS.SignalsListener);
            }
        }
    }
};

interface ShutdownFixture {
    exitSpy: ReturnType<typeof vi.spyOn>;
}

const installFixture = (): ShutdownFixture => {
    const fixture = {} as ShutdownFixture;
    let snap: Snapshot;
    beforeEach(() => {
        fixture.exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        snap = snapshotListeners();
    });
    afterEach(() => {
        fixture.exitSpy.mockRestore();
        restoreListeners(snap);
    });
    return fixture;
};

describe("installGracefulShutdown — basic exit codes", () => {
    const fixture = installFixture();

    it("calls onSignal then exits with the canonical code on SIGINT", async () => {
        const onSignal = vi.fn();
        installGracefulShutdown({ onSignal });

        process.emit("SIGINT", "SIGINT");
        await flush();

        expect(onSignal).toHaveBeenCalledWith("SIGINT");
        expect(fixture.exitSpy).toHaveBeenCalledWith(130);
    });

    it("handles SIGHUP", async () => {
        const onSignal = vi.fn();
        installGracefulShutdown({ onSignal });

        process.emit("SIGHUP", "SIGHUP");
        await flush();

        expect(onSignal).toHaveBeenCalledWith("SIGHUP");
        expect(fixture.exitSpy).toHaveBeenCalledWith(143);
    });
});

describe("installGracefulShutdown — async + force-kill behaviour", () => {
    const fixture = installFixture();

    it("awaits an async onSignal before exiting", async () => {
        let resolveSignal: () => void = () => {};
        const onSignal = vi.fn().mockReturnValue(new Promise<void>((res) => (resolveSignal = res)));
        installGracefulShutdown({ onSignal });

        process.emit("SIGTERM", "SIGTERM");
        await flush();

        expect(onSignal).toHaveBeenCalled();
        expect(fixture.exitSpy).not.toHaveBeenCalled();

        resolveSignal();
        await flush();

        expect(fixture.exitSpy).toHaveBeenCalledWith(143);
    });

    it.each([
        { signal: "SIGINT", exitCode: 130 },
        { signal: "SIGTERM", exitCode: 143 },
        { signal: "SIGHUP", exitCode: 143 },
    ] as const)("invokes onForce immediately on a second $signal", async ({ signal, exitCode }) => {
        const onSignal = vi.fn().mockReturnValue(new Promise<void>(() => {}));
        const onForce = vi.fn();
        installGracefulShutdown({ onSignal, onForce, forceKillAfterMs: 0 });

        process.emit(signal, signal);
        process.emit(signal, signal);
        await flush();

        expect(onForce).toHaveBeenCalledOnce();
        expect(fixture.exitSpy).toHaveBeenCalledWith(exitCode);
    });
});

describe("installGracefulShutdown — force-kill escalation and error paths", () => {
    const fixture = installFixture();

    it("escalates to onForce when forceKillAfterMs elapses before onSignal settles", async () => {
        vi.useFakeTimers();
        const onSignal = vi.fn().mockReturnValue(new Promise<void>(() => {}));
        const onForce = vi.fn();
        installGracefulShutdown({ onSignal, onForce, forceKillAfterMs: 50 });

        process.emit("SIGINT", "SIGINT");
        await vi.advanceTimersByTimeAsync(60);
        vi.useRealTimers();
        await flush();

        expect(onForce).toHaveBeenCalledOnce();
        expect(fixture.exitSpy).toHaveBeenCalledWith(130);
    });

    it("logs an error and still exits when onSignal rejects", async () => {
        const errorSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        const onSignal = vi.fn().mockRejectedValue(new Error("shutdown boom"));
        installGracefulShutdown({ onSignal });

        process.emit("SIGTERM", "SIGTERM");
        await flush();

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("graceful shutdown failed"));
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("shutdown boom"));
        expect(fixture.exitSpy).toHaveBeenCalledWith(143);
        errorSpy.mockRestore();
    });
});

describe("installGracefulShutdown — overrides", () => {
    const fixture = installFixture();

    it("uses exitCode override when provided", async () => {
        installGracefulShutdown({
            onSignal: () => undefined,
            exitCode: () => 7,
        });

        process.emit("SIGINT", "SIGINT");
        await flush();

        expect(fixture.exitSpy).toHaveBeenCalledWith(7);
    });
});
