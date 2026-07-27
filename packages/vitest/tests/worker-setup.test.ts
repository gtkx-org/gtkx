import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const installGracefulShutdown = vi.hoisted(() => vi.fn());

const { isHeadlessShutdownInstalled, setHeadlessShutdownInstalled, setHeadlessTeardown } = await import(
    "../src/headless-globals.js",
);

const { installHeadlessShutdown } = await import("../src/install-headless-shutdown.js");

const resetGlobals = (): void => {
    setHeadlessTeardown(undefined);
    setHeadlessShutdownInstalled(undefined);
};

vi.mock("@gtkx/utils", () => ({ installGracefulShutdown }));

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
        setHeadlessTeardown(teardown);
        installHeadlessShutdown();
        expect(installGracefulShutdown).toHaveBeenCalledTimes(1);
        expect(installGracefulShutdown).toHaveBeenCalledWith({ onSignal: teardown });
        expect(isHeadlessShutdownInstalled()).toBe(true);
    });

    it("installs the handlers only once per process", () => {
        setHeadlessTeardown(vi.fn());
        installHeadlessShutdown();
        installHeadlessShutdown();
        expect(installGracefulShutdown).toHaveBeenCalledTimes(1);
    });
});
