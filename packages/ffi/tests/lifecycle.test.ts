import { type ApplicationLike, onExit, quitApplication, runApplication } from "@gtkx/ffi";
import { describe, expect, it, vi } from "vitest";

const nativeMock = vi.hoisted(() => ({ quit: vi.fn(), keepAlive: vi.fn() }));
const signalMock = vi.hoisted(() => ({ blockMatchedSignalHandlers: vi.fn() }));

vi.mock("@gtkx/native", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@gtkx/native")>();
    return { ...actual, quit: nativeMock.quit, keepAlive: nativeMock.keepAlive };
});

vi.mock("../src/signal.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/signal.js")>();
    return { ...actual, blockMatchedSignalHandlers: signalMock.blockMatchedSignalHandlers };
});

type FakeApplication = ApplicationLike & {
    registerCalls: number;
    activateCalls: number;
    quitCalls: number;
    runCalls: number;
    shutdownEmits: number;
    lastRunArgv: string[] | null;
    windows: object[];
    windowsAtRun: number | null;
    emit(signal: "activate" | "shutdown"): void;
};

const createFakeApplication = (windows: object[] = []): FakeApplication => {
    const handlers: Record<"activate" | "shutdown", (() => void)[]> = { activate: [], shutdown: [] };
    let registered = false;
    return {
        registerCalls: 0,
        activateCalls: 0,
        quitCalls: 0,
        runCalls: 0,
        shutdownEmits: 0,
        lastRunArgv: null,
        windows: [...windows],
        windowsAtRun: null,
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
        quit() {
            this.quitCalls++;
        },
        run(argv: string[]) {
            this.runCalls++;
            this.lastRunArgv = argv;
            this.windowsAtRun = this.windows.length;
            registered = false;
            this.emit("shutdown");
            return 0;
        },
        getWindows() {
            return [...this.windows];
        },
        removeWindow(window: object) {
            this.windows = this.windows.filter((candidate) => candidate !== window);
        },
        on(signal, handler) {
            handlers[signal].push(handler);
            return undefined;
        },
        emit(signal) {
            if (signal === "shutdown") this.shutdownEmits++;
            for (const handler of handlers[signal]) handler();
        },
    };
};

describe("runApplication and quitApplication", () => {
    it("registers, activates, and holds the loop alive until shutdown", () => {
        const app = createFakeApplication();
        nativeMock.keepAlive.mockClear();

        runApplication(app);

        expect(app.registerCalls).toBe(1);
        expect(app.activateCalls).toBe(1);
        expect(app.getIsRegistered()).toBe(true);
        expect(nativeMock.keepAlive).toHaveBeenLastCalledWith(true);

        quitApplication(app);
        expect(signalMock.blockMatchedSignalHandlers).toHaveBeenCalledWith(app, "activate");
        expect(app.lastRunArgv).toEqual([]);
        expect(app.shutdownEmits).toBe(1);
        expect(app.quitCalls).toBe(1);
        expect(app.getIsRegistered()).toBe(false);
        expect(nativeMock.keepAlive).toHaveBeenLastCalledWith(false);

        quitApplication(app);
        expect(app.runCalls).toBe(1);
    });

    it("blocks activate handlers before running the application", () => {
        const app = createFakeApplication();
        const order: string[] = [];
        signalMock.blockMatchedSignalHandlers.mockImplementationOnce(() => order.push("block"));
        const originalRun = app.run.bind(app);
        app.run = (argv: string[]) => {
            order.push("run");
            return originalRun(argv);
        };

        runApplication(app);
        quitApplication(app);

        expect(order).toEqual(["block", "run"]);
    });

    it("removes every held window before running the application", () => {
        const app = createFakeApplication([{ id: "w1" }, { id: "w2" }]);

        runApplication(app);
        quitApplication(app);

        expect(app.windows).toEqual([]);
        expect(app.windowsAtRun).toBe(0);
    });

    it("does not re-register an already-registered application", () => {
        const app = createFakeApplication();
        app.register(null);

        runApplication(app);

        expect(app.registerCalls).toBe(1);

        quitApplication(app);
    });

    it("does nothing when the application was never registered", () => {
        const app = createFakeApplication();

        quitApplication(app);

        expect(app.runCalls).toBe(0);
        expect(app.shutdownEmits).toBe(0);
        expect(app.activateCalls).toBe(0);
    });

    it("forwards keepalive to the native loop on each activation", () => {
        const app = createFakeApplication();
        nativeMock.keepAlive.mockClear();

        runApplication(app);
        app.activate();

        expect(app.activateCalls).toBe(2);
        expect(nativeMock.keepAlive).toHaveBeenCalledWith(true);

        quitApplication(app);
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
