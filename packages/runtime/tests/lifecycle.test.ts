import { onExit, quitApplication, runApplication } from "@gtkx/runtime";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationLike } from "../src/lifecycle.js";

type CommandLineOutcome = {
    isRegistered: boolean;
    hasActivated: boolean;
    exitStatus: number;
};

type FakeApplicationOptions = {
    outcome?: Partial<CommandLineOutcome>;
    windows?: object[];
};

const nativeMock = vi.hoisted(() => ({ quit: vi.fn(), keepAlive: vi.fn() }));
const DEFAULT_OUTCOME: CommandLineOutcome = { isRegistered: true, hasActivated: true, exitStatus: 0 };

class FakeApplication implements ApplicationLike {
    private handlers: Record<"activate" | "shutdown", (() => void)[]> = { activate: [], shutdown: [] };
    private isRegistered = false;
    private outcome: CommandLineOutcome;

    activateCalls = 0;
    registerCalls = 0;
    runCalls = 0;
    shutdownEmits = 0;
    lastArgv: string[] | null = null;
    windows: object[];
    windowsAtShutdown: number | null = null;

    constructor({ outcome, windows = [] }: FakeApplicationOptions = {}) {
        this.outcome = { ...DEFAULT_OUTCOME, ...outcome };
        this.windows = [...windows];
    }

    getIsRegistered(): boolean {
        return this.isRegistered;
    }

    vfuncLocalCommandLine(argv: string[]): [boolean, string[], number] {
        this.lastArgv = argv;
        this.isRegistered = this.outcome.isRegistered;

        if (this.outcome.hasActivated) {
            this.activate();
        }

        return [true, argv, this.outcome.exitStatus];
    }

    run(argv: string[]): number {
        this.runCalls++;
        this.emit("shutdown");
        this.isRegistered = false;

        return argv.length;
    }

    register(): boolean {
        this.registerCalls++;
        this.isRegistered = true;

        return true;
    }

    activate(): void {
        this.activateCalls++;
        this.emit("activate");
    }

    getWindows(): object[] {
        return [...this.windows];
    }

    removeWindow(window: object): void {
        this.windows = this.windows.filter((candidate) => candidate !== window);
    }

    on(signal: "activate" | "shutdown", handler: () => void): void {
        this.handlers[signal].push(handler);
    }

    emit(signal: "activate" | "shutdown"): void {
        if (signal === "shutdown") {
            this.shutdownEmits++;
            this.windowsAtShutdown = this.windows.length;
        }

        const handlers = this.handlers[signal];

        for (const handler of handlers) {
            handler();
        }
    }
}

vi.mock("@gtkx/native", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@gtkx/native")>();

    return { ...actual, quit: nativeMock.quit, keepAlive: nativeMock.keepAlive };
});

describe("runApplication and quitApplication — full lifecycle", () => {
    it("hands the command line to GLib, activates, and holds the loop alive until shutdown", () => {
        const app = new FakeApplication();
        nativeMock.keepAlive.mockClear();
        expect(runApplication(app, ["probe", "--flag"])).toEqual({ isPrimary: true, exitStatus: 0 });
        expect(app.lastArgv).toEqual(["probe", "--flag"]);
        expect(app.activateCalls).toBe(1);
        expect(nativeMock.keepAlive).toHaveBeenLastCalledWith(true);
        quitApplication(app);
        expect(app.shutdownEmits).toBe(1);
        expect(nativeMock.keepAlive).toHaveBeenLastCalledWith(false);
    });

    it("leaves GLib's own shutdown alone for an application GTKX did not derive", () => {
        const app = new FakeApplication();
        runApplication(app, ["probe"]);
        quitApplication(app);
        expect(app.runCalls).toBe(0);
        expect(app.shutdownEmits).toBe(1);
    });

    it("shuts down only once", () => {
        const app = new FakeApplication();
        runApplication(app, ["probe"]);
        quitApplication(app);
        quitApplication(app);
        expect(app.shutdownEmits).toBe(1);
    });

    it("removes every held window before shutting down", () => {
        const app = new FakeApplication({ windows: [{ id: "w1" }, { id: "w2" }] });
        runApplication(app, ["probe"]);
        quitApplication(app);
        expect(app.windows).toEqual([]);
        expect(app.windowsAtShutdown).toBe(0);
    });

    it("does nothing when the command line left the application unregistered", () => {
        const app = new FakeApplication({ outcome: { isRegistered: false, hasActivated: false } });
        runApplication(app, ["probe"]);
        quitApplication(app);
        expect(app.shutdownEmits).toBe(0);
    });
});

describe("runApplication — starting an application a second time", () => {
    it("registers and activates instead of reading the command line again", () => {
        const app = new FakeApplication();
        runApplication(app, ["probe"]);
        quitApplication(app);
        app.lastArgv = null;
        expect(runApplication(app, ["probe", "--flag"])).toEqual({ isPrimary: true, exitStatus: 0 });
        expect(app.lastArgv).toBeNull();
        expect(app.registerCalls).toBe(1);
        expect(app.activateCalls).toBe(2);
        expect(app.getIsRegistered()).toBe(true);
    });

    it("shuts down again after being started again", () => {
        const app = new FakeApplication();
        runApplication(app, ["probe"]);
        quitApplication(app);
        runApplication(app, ["probe"]);
        quitApplication(app);
        expect(app.shutdownEmits).toBe(2);
    });
});

describe("runApplication — registration and keepalive", () => {
    it("holds the loop alive for a registered application that never activated", () => {
        const app = new FakeApplication({ outcome: { hasActivated: false } });
        nativeMock.keepAlive.mockClear();

        expect(runApplication(app, ["probe", "--gapplication-service"])).toEqual({
            isPrimary: true,
            exitStatus: 0,
        });

        expect(app.activateCalls).toBe(0);
        expect(nativeMock.keepAlive).toHaveBeenCalledTimes(1);
        expect(nativeMock.keepAlive).toHaveBeenCalledWith(true);
        app.activate();
        expect(app.activateCalls).toBe(1);
        quitApplication(app);
    });

    it("reports the exit status and stays non-primary when nothing registered", () => {
        const app = new FakeApplication({
            outcome: { isRegistered: false, hasActivated: false, exitStatus: 2 },
        });

        expect(runApplication(app, ["probe", "--nope"])).toEqual({ isPrimary: false, exitStatus: 2 });
        expect(app.activateCalls).toBe(0);
    });

    it("forwards keepalive to the native loop on each activation", () => {
        const app = new FakeApplication();
        nativeMock.keepAlive.mockClear();
        runApplication(app, ["probe"]);
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
