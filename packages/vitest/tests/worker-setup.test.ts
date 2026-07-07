import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const installGracefulShutdown = vi.hoisted(() => vi.fn());

vi.mock("@gtkx/utils", () => ({ installGracefulShutdown }));

const { installHeadlessShutdown } = await import("../src/worker-setup.js");

const resetGlobals = (): void => {
    globalThis.gtkxHeadlessTeardown = undefined;
    globalThis.gtkxHeadlessShutdownInstalled = undefined;
};

describe("installHeadlessShutdown", () => {
    beforeEach(() => {
        installGracefulShutdown.mockClear();
        resetGlobals();
    });

    afterEach(resetGlobals);

    it("does nothing when the preload stashed no teardown", () => {
        installHeadlessShutdown();
        expect(installGracefulShutdown).not.toHaveBeenCalled();
    });

    it("wires the stashed teardown into the shared graceful shutdown", () => {
        const teardown = vi.fn();
        globalThis.gtkxHeadlessTeardown = teardown;

        installHeadlessShutdown();

        expect(installGracefulShutdown).toHaveBeenCalledTimes(1);
        expect(installGracefulShutdown).toHaveBeenCalledWith({ onSignal: teardown });
        expect(globalThis.gtkxHeadlessShutdownInstalled).toBe(true);
    });

    it("installs the handlers only once per process", () => {
        globalThis.gtkxHeadlessTeardown = vi.fn();

        installHeadlessShutdown();
        installHeadlessShutdown();

        expect(installGracefulShutdown).toHaveBeenCalledTimes(1);
    });
});
