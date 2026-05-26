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

describe("installGracefulShutdown", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let prevSigInt: NodeJS.SignalsListener[];
    let prevSigTerm: NodeJS.SignalsListener[];
    let prevSigHup: NodeJS.SignalsListener[];

    beforeEach(() => {
        exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        prevSigInt = process.listeners("SIGINT") as NodeJS.SignalsListener[];
        prevSigTerm = process.listeners("SIGTERM") as NodeJS.SignalsListener[];
        prevSigHup = process.listeners("SIGHUP") as NodeJS.SignalsListener[];
    });

    afterEach(() => {
        exitSpy.mockRestore();
        for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
            const prev = sig === "SIGINT" ? prevSigInt : sig === "SIGTERM" ? prevSigTerm : prevSigHup;
            for (const listener of process.listeners(sig)) {
                if (!prev.includes(listener as NodeJS.SignalsListener)) {
                    process.removeListener(sig, listener as NodeJS.SignalsListener);
                }
            }
        }
    });

    const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

    it("calls onSignal then exits with the canonical code", async () => {
        const onSignal = vi.fn();
        const handle = installGracefulShutdown({ onSignal });

        process.emit("SIGINT", "SIGINT");
        await flush();

        expect(onSignal).toHaveBeenCalledWith("SIGINT");
        expect(exitSpy).toHaveBeenCalledWith(130);
        handle.uninstall();
    });

    it("handles SIGHUP", async () => {
        const onSignal = vi.fn();
        const handle = installGracefulShutdown({ onSignal });

        process.emit("SIGHUP", "SIGHUP");
        await flush();

        expect(onSignal).toHaveBeenCalledWith("SIGHUP");
        expect(exitSpy).toHaveBeenCalledWith(143);
        handle.uninstall();
    });

    it("awaits an async onSignal before exiting", async () => {
        let resolveSignal!: () => void;
        const onSignal = vi.fn().mockReturnValue(new Promise<void>((res) => (resolveSignal = res)));
        const handle = installGracefulShutdown({ onSignal });

        process.emit("SIGTERM", "SIGTERM");
        await flush();

        expect(onSignal).toHaveBeenCalled();
        expect(exitSpy).not.toHaveBeenCalled();

        resolveSignal();
        await flush();

        expect(exitSpy).toHaveBeenCalledWith(143);
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
        expect(exitSpy).toHaveBeenCalledWith(130);
        handle.uninstall();
    });

    it("uses exitCode override when provided", async () => {
        const handle = installGracefulShutdown({
            onSignal: () => undefined,
            exitCode: () => 7,
        });

        process.emit("SIGINT", "SIGINT");
        await flush();

        expect(exitSpy).toHaveBeenCalledWith(7);
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
