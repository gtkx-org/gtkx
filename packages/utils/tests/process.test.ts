import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exitCodeForSignal, installGracefulShutdown } from "../src/process/index.js";

type SignalListener = (signal: NodeJS.Signals) => void;
type Snapshot = Record<(typeof HANDLED_SIGNALS)[number], SignalListener[]>;
type Deferred = { promise: Promise<void>; resolve: () => void };
type ShutdownFixture = { exitSpy: MockInstance<typeof process.exit> };

const HANDLED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const neverSettles = (): Promise<void> => new Promise<void>((): void => undefined);

const createDeferred = (): Deferred => {
    const deferred = {} as Deferred;

    deferred.promise = new Promise<void>((resolve) => {
        deferred.resolve = resolve;
    });

    return deferred;
};

const snapshotListeners = (): Snapshot => {
    const snap = {} as Snapshot;

    for (const sig of HANDLED_SIGNALS) {
        snap[sig] = process.listeners(sig) as SignalListener[];
    }

    return snap;
};

const restoreSignalListeners = (sig: (typeof HANDLED_SIGNALS)[number], snap: Snapshot): void => {
    for (const listener of process.listeners(sig)) {
        if (!snap[sig].includes(listener as SignalListener)) {
            process.removeListener(sig, listener as SignalListener);
        }
    }
};

const restoreListeners = (snap: Snapshot): void => {
    for (const sig of HANDLED_SIGNALS) {
        restoreSignalListeners(sig, snap);
    }
};

const installFixture = (): ShutdownFixture => {
    const fixture = {} as ShutdownFixture;
    let snap: Snapshot;

    beforeEach(() => {
        fixture.exitSpy = vi.spyOn(process, "exit").mockImplementation(vi.fn() as never);
        snap = snapshotListeners();
    });

    afterEach(() => {
        vi.useRealTimers();
        fixture.exitSpy.mockRestore();
        restoreListeners(snap);
    });

    return fixture;
};

const installNeverSettlingShutdown = (options: { forceKillAfterMs: number; coalesceWindowMs?: number }) => {
    vi.useFakeTimers();
    const onSignal = vi.fn().mockReturnValue(neverSettles());
    const onForce = vi.fn();
    installGracefulShutdown({ onSignal, onForce, ...options });

    return { onSignal, onForce };
};

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

describe("installGracefulShutdown — clean shutdown exits 0", () => {
    const fixture = installFixture();

    it.each(["SIGINT", "SIGHUP"] as const)("calls onSignal then exits 0 after a clean shutdown on %s", async (
        signal,
    ) => {
        const onSignal = vi.fn();
        installGracefulShutdown({ onSignal });
        process.emit(signal, signal);
        await flush();
        expect(onSignal).toHaveBeenCalledWith(signal);
        expect(fixture.exitSpy).toHaveBeenCalledWith(0);
    });
});

describe("installGracefulShutdown — async + force-kill behavior", () => {
    const fixture = installFixture();

    it("awaits an async onSignal before exiting", async () => {
        const gate = createDeferred();
        const onSignal = vi.fn().mockReturnValue(gate.promise);
        installGracefulShutdown({ onSignal });
        process.emit("SIGTERM", "SIGTERM");
        await flush();
        expect(onSignal).toHaveBeenCalled();
        expect(fixture.exitSpy).not.toHaveBeenCalled();
        gate.resolve();
        await flush();
        expect(fixture.exitSpy).toHaveBeenCalledWith(0);
    });

    it("coalesces a duplicate delivery of the same signal within the window", async () => {
        const onSignal = vi.fn().mockReturnValue(neverSettles());
        const onForce = vi.fn();
        installGracefulShutdown({ onSignal, onForce, forceKillAfterMs: 0, coalesceWindowMs: 500 });
        process.emit("SIGINT", "SIGINT");
        process.emit("SIGINT", "SIGINT");
        await flush();
        expect(onSignal).toHaveBeenCalledOnce();
        expect(onForce).not.toHaveBeenCalled();
        expect(fixture.exitSpy).not.toHaveBeenCalled();
    });

    it.each([
        { signal: "SIGINT", exitCode: 130 },
        { signal: "SIGTERM", exitCode: 143 },
        { signal: "SIGHUP", exitCode: 143 },
    ] as const)(
        "invokes onForce on a deliberate second $signal after the coalesce window",
        async ({ signal, exitCode }) => {
            const { onForce } = installNeverSettlingShutdown({ forceKillAfterMs: 0, coalesceWindowMs: 500 });
            process.emit(signal, signal);
            await vi.advanceTimersByTimeAsync(600);
            process.emit(signal, signal);
            vi.useRealTimers();
            await flush();
            expect(onForce).toHaveBeenCalledOnce();
            expect(fixture.exitSpy).toHaveBeenCalledWith(exitCode);
        },
    );
});

describe("installGracefulShutdown — force-kill escalation and error paths", () => {
    const fixture = installFixture();

    it("escalates to onForce when forceKillAfterMs elapses before onSignal settles", async () => {
        const { onForce } = installNeverSettlingShutdown({ forceKillAfterMs: 50 });
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
            onSignal: vi.fn(),
            exitCode: () => 7,
        });

        process.emit("SIGINT", "SIGINT");
        await flush();
        expect(fixture.exitSpy).toHaveBeenCalledWith(7);
    });

    it("reports isGraceful=true to the override after a clean shutdown", async () => {
        const exitCode = vi.fn(() => 0);
        installGracefulShutdown({ onSignal: vi.fn(), exitCode });
        process.emit("SIGINT", "SIGINT");
        await flush();
        expect(exitCode).toHaveBeenCalledWith("SIGINT", true);
    });

    it("reports isGraceful=false to the override when a deliberate second signal forces exit", async () => {
        vi.useFakeTimers();
        const exitCode = vi.fn(() => 0);

        installGracefulShutdown({
            onSignal: neverSettles,
            onForce: vi.fn(),
            forceKillAfterMs: 0,
            coalesceWindowMs: 500,
            exitCode,
        });

        process.emit("SIGINT", "SIGINT");
        await vi.advanceTimersByTimeAsync(600);
        process.emit("SIGINT", "SIGINT");
        vi.useRealTimers();
        await flush();
        expect(exitCode).toHaveBeenCalledWith("SIGINT", false);
    });
});
