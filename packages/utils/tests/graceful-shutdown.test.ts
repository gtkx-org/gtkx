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
        const handle = installGracefulShutdown({ onSignal });

        process.emit("SIGINT", "SIGINT");
        await flush();

        expect(onSignal).toHaveBeenCalledWith("SIGINT");
        expect(fixture.exitSpy).toHaveBeenCalledWith(130);
        handle.uninstall();
    });

    it("handles SIGHUP", async () => {
        const onSignal = vi.fn();
        const handle = installGracefulShutdown({ onSignal });

        process.emit("SIGHUP", "SIGHUP");
        await flush();

        expect(onSignal).toHaveBeenCalledWith("SIGHUP");
        expect(fixture.exitSpy).toHaveBeenCalledWith(143);
        handle.uninstall();
    });
});

describe("installGracefulShutdown — async + force-kill behaviour", () => {
    const fixture = installFixture();

    it("awaits an async onSignal before exiting", async () => {
        let resolveSignal!: () => void;
        const onSignal = vi.fn().mockReturnValue(new Promise<void>((res) => (resolveSignal = res)));
        const handle = installGracefulShutdown({ onSignal });

        process.emit("SIGTERM", "SIGTERM");
        await flush();

        expect(onSignal).toHaveBeenCalled();
        expect(fixture.exitSpy).not.toHaveBeenCalled();

        resolveSignal();
        await flush();

        expect(fixture.exitSpy).toHaveBeenCalledWith(143);
        handle.uninstall();
    });

    it("invokes onForce immediately on a second SIGINT", async () => {
        const onSignal = vi.fn().mockReturnValue(new Promise<void>(() => {}));
        const onForce = vi.fn();
        const handle = installGracefulShutdown({ onSignal, onForce, forceKillAfterMs: 0 });

        process.emit("SIGINT", "SIGINT");
        process.emit("SIGINT", "SIGINT");
        await flush();

        expect(onForce).toHaveBeenCalledOnce();
        expect(fixture.exitSpy).toHaveBeenCalledWith(130);
        handle.uninstall();
    });
});

describe("installGracefulShutdown — force-kill escalation and error paths", () => {
    const fixture = installFixture();

    it("escalates to onForce when forceKillAfterMs elapses before onSignal settles", async () => {
        vi.useFakeTimers();
        const onSignal = vi.fn().mockReturnValue(new Promise<void>(() => {}));
        const onForce = vi.fn();
        const handle = installGracefulShutdown({ onSignal, onForce, forceKillAfterMs: 50 });

        process.emit("SIGINT", "SIGINT");
        await vi.advanceTimersByTimeAsync(60);
        vi.useRealTimers();
        await flush();

        expect(onForce).toHaveBeenCalledOnce();
        expect(fixture.exitSpy).toHaveBeenCalledWith(130);
        handle.uninstall();
    });

    it("logs an error and still exits when onSignal rejects", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const onSignal = vi.fn().mockRejectedValue(new Error("shutdown boom"));
        const handle = installGracefulShutdown({ onSignal });

        process.emit("SIGTERM", "SIGTERM");
        await flush();

        expect(errorSpy).toHaveBeenCalledWith(
            "Graceful shutdown error:",
            expect.objectContaining({ message: "shutdown boom" }),
        );
        expect(fixture.exitSpy).toHaveBeenCalledWith(143);
        errorSpy.mockRestore();
        handle.uninstall();
    });
});

describe("installGracefulShutdown — overrides and uninstall", () => {
    const fixture = installFixture();

    it("uses exitCode override when provided", async () => {
        const handle = installGracefulShutdown({
            onSignal: () => undefined,
            exitCode: () => 7,
        });

        process.emit("SIGINT", "SIGINT");
        await flush();

        expect(fixture.exitSpy).toHaveBeenCalledWith(7);
        handle.uninstall();
    });

    it("uninstall removes signal listeners", () => {
        const baselineInt = process.listenerCount("SIGINT");
        const handle = installGracefulShutdown({ onSignal: () => undefined });
        expect(process.listenerCount("SIGINT")).toBe(baselineInt + 1);
        handle.uninstall();
        expect(process.listenerCount("SIGINT")).toBe(baselineInt);
    });
});
