import { onExit, quitApplication, runApplication } from "@gtkx/runtime";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationLike } from "../src/lifecycle.js";

const nativeMock = vi.hoisted(() => ({ quit: vi.fn(), keepAlive: vi.fn() }));

const foreignApplication = (): ApplicationLike => ({
    getIsRegistered: () => false,
    register: () => true,
    activate: vi.fn(),
    run: () => 0,
    on: vi.fn(),
    emit: vi.fn(),
});

vi.mock("@gtkx/native", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@gtkx/native")>();

    return { ...actual, quit: nativeMock.quit, keepAlive: nativeMock.keepAlive };
});

describe("runApplication — an application GTKX did not build", () => {
    it("refuses to start it rather than parsing its command line", () => {
        const application = foreignApplication();
        nativeMock.keepAlive.mockClear();
        expect(() => runApplication(application, ["probe"])).toThrow(/not built by GTKX/);
        expect(nativeMock.keepAlive).not.toHaveBeenCalled();
    });

    it("names the supported ways of building one", () => {
        expect(() => runApplication(foreignApplication(), ["probe"])).toThrow(/createApplication/);
    });
});

describe("quitApplication — an application that never registered", () => {
    it("does nothing at all", () => {
        const application = foreignApplication();
        const emit = vi.spyOn(application, "emit");
        quitApplication(application);
        expect(emit).not.toHaveBeenCalled();
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
