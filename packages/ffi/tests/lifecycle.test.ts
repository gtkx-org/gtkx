import { onExit, quitApplication, runApplication } from "@gtkx/ffi";
import { describe, expect, it, vi } from "vitest";

const nativeMock = vi.hoisted(() => ({ quit: vi.fn() }));

vi.mock("@gtkx/native", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@gtkx/native")>();
    return { ...actual, quit: nativeMock.quit };
});

type FakeApplication = {
    registerCalls: number;
    activateCalls: number;
    getIsRegistered(): boolean;
    register(cancellable: null): boolean;
    activate(): void;
    on(signal: "activate" | "shutdown", handler: () => void): unknown;
    emit(signal: "activate" | "shutdown"): void;
};

const createFakeApplication = (): FakeApplication => {
    const handlers: Record<"activate" | "shutdown", (() => void)[]> = { activate: [], shutdown: [] };
    let registered = false;
    return {
        registerCalls: 0,
        activateCalls: 0,
        getIsRegistered: () => registered,
        register(_cancellable: null) {
            this.registerCalls++;
            registered = true;
            return true;
        },
        activate() {
            this.activateCalls++;
            this.emit("activate");
        },
        on(signal, handler) {
            handlers[signal].push(handler);
            return undefined;
        },
        emit(signal) {
            for (const handler of handlers[signal]) handler();
        },
    };
};

describe("runApplication and quitApplication", () => {
    it("registers, activates, and holds the loop alive until shutdown", () => {
        vi.useFakeTimers();
        try {
            const app = createFakeApplication();
            const before = vi.getTimerCount();

            runApplication(app);

            expect(app.registerCalls).toBe(1);
            expect(app.activateCalls).toBe(1);
            expect(app.getIsRegistered()).toBe(true);
            expect(vi.getTimerCount()).toBe(before + 1);

            quitApplication(app);
            expect(vi.getTimerCount()).toBe(before);

            quitApplication(app);
            expect(vi.getTimerCount()).toBe(before);
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not re-register an already-registered application", () => {
        vi.useFakeTimers();
        try {
            const app = createFakeApplication();
            app.register(null);

            runApplication(app);

            expect(app.registerCalls).toBe(1);

            quitApplication(app);
        } finally {
            vi.useRealTimers();
        }
    });

    it("keeps a single keepalive when the application activates again", () => {
        vi.useFakeTimers();
        try {
            const app = createFakeApplication();
            const before = vi.getTimerCount();

            runApplication(app);
            app.activate();

            expect(vi.getTimerCount()).toBe(before + 1);

            quitApplication(app);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("onExit", () => {
    it("runs registered callbacks once when the process exits, then ignores further exits", () => {
        let count = 0;
        onExit(() => count++);

        process.emit("exit", 0);
        expect(count).toBe(1);
        expect(nativeMock.quit).toHaveBeenCalledTimes(1);

        process.emit("exit", 0);
        expect(count).toBe(1);
        expect(nativeMock.quit).toHaveBeenCalledTimes(1);
    });
});
