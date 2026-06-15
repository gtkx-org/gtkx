import { onExit, quitApplication, runApplication } from "@gtkx/ffi";
import { describe, expect, it, vi } from "vitest";

const nativeMock = vi.hoisted(() => ({ stop: vi.fn() }));

vi.mock("@gtkx/native", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@gtkx/native")>();
    return { ...actual, stop: nativeMock.stop };
});

const sigintListenerCount = (): number => process.listenerCount("SIGINT");

const withShutdownHandlersEnabled = async (body: () => void | Promise<void>): Promise<void> => {
    const previous = process.env.GTKX_DISABLE_SHUTDOWN_HANDLERS;
    delete process.env.GTKX_DISABLE_SHUTDOWN_HANDLERS;
    try {
        await body();
    } finally {
        process.env.GTKX_DISABLE_SHUTDOWN_HANDLERS = previous;
    }
};

describe("runApplication and quitApplication", () => {
    it("quits the application even when no run is in progress", () => {
        let calls = 0;
        const app = { quit: () => calls++ };

        quitApplication(app);

        expect(calls).toBe(1);
    });

    it("skips signal handlers when GTKX_DISABLE_SHUTDOWN_HANDLERS is set", () => {
        const before = sigintListenerCount();
        const app = { quit: () => undefined };

        runApplication(app);

        expect(sigintListenerCount()).toBe(before);

        quitApplication(app);
    });

    it("installs signal handlers on run and removes them on quit", async () => {
        await withShutdownHandlersEnabled(() => {
            const before = sigintListenerCount();
            let quitCalls = 0;
            const app = { quit: () => quitCalls++ };

            runApplication(app);
            expect(sigintListenerCount()).toBe(before + 1);

            quitApplication(app);
            expect(sigintListenerCount()).toBe(before);
            expect(quitCalls).toBe(1);
        });
    });

    it("installs a single handler set across repeated runs", async () => {
        await withShutdownHandlersEnabled(() => {
            const before = sigintListenerCount();
            const app = { quit: () => undefined };

            runApplication(app);
            runApplication(app);
            expect(sigintListenerCount()).toBe(before + 1);

            quitApplication(app);
            expect(sigintListenerCount()).toBe(before);
        });
    });

    it("quits the running application when a shutdown signal arrives", async () => {
        await withShutdownHandlersEnabled(async () => {
            const before = sigintListenerCount();
            const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
            let quitCalls = 0;
            const app = { quit: () => quitCalls++ };

            runApplication(app);
            process.emit("SIGINT", "SIGINT");
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(quitCalls).toBe(1);
            expect(sigintListenerCount()).toBe(before);
            expect(exitSpy).toHaveBeenCalledWith(130);
            exitSpy.mockRestore();
        });
    });
});

describe("onExit", () => {
    it("runs registered callbacks once when the process exits, then ignores further exits", () => {
        let count = 0;
        onExit(() => count++);

        process.emit("exit", 0);
        expect(count).toBe(1);
        expect(nativeMock.stop).toHaveBeenCalledTimes(1);

        process.emit("exit", 0);
        expect(count).toBe(1);
        expect(nativeMock.stop).toHaveBeenCalledTimes(1);
    });
});
