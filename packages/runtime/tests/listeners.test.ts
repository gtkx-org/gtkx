import type { Object as GObject } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it, type Mock, vi } from "vitest";

type ClickedHandler = () => void;
type RegisterClicked = (button: Gtk.Button, handler: ClickedHandler) => GObject;
type ClickedTarget = { button: Gtk.Button; handler: Mock<ClickedHandler> };

const chainingHandler = vi.fn();

const onClicked: RegisterClicked = (button, handler) => button.on("clicked", handler);
const onceClicked: RegisterClicked = (button, handler) => button.once("clicked", handler);
const offClicked: RegisterClicked = (button, handler) => button.off("clicked", handler);
// eslint-disable-next-line @typescript-eslint/no-deprecated -- covers the alias until it is removed in v2
const addClickedListener: RegisterClicked = (button, handler) => button.addEventListener("clicked", handler);
// eslint-disable-next-line @typescript-eslint/no-deprecated -- covers the alias until it is removed in v2
const removeClickedListener: RegisterClicked = (button, handler) => button.removeEventListener("clicked", handler);
const createClickedTarget = (): ClickedTarget => ({ button: new Gtk.Button(), handler: vi.fn() });

const applyClicked = (target: ClickedTarget, operation: RegisterClicked, count: number): void => {
    for (let index = 0; index < count; index += 1) {
        operation(target.button, target.handler);
    }
};

const expectEmissionCalls = (target: ClickedTarget, expected: number): void => {
    target.handler.mockClear();
    target.button.emit("clicked");
    expect(target.handler).toHaveBeenCalledTimes(expected);
};

const expectRemovableHandlerNeverFires = (register: RegisterClicked): void => {
    const target = createClickedTarget();
    register(target.button, target.handler);
    offClicked(target.button, target.handler);
    expect(target.handler).not.toHaveBeenCalled();
};

const expectRegisterReturnsButton = (register: RegisterClicked): void => {
    const button = new Gtk.Button();
    const result = register(button, chainingHandler);
    expect(result).toBe(button);
    button.off("clicked", chainingHandler);
};

const expectBalancedRegistrationsLeaveNothingConnected = (
    register: RegisterClicked,
    remove: RegisterClicked,
    count: number,
): void => {
    const target = createClickedTarget();
    applyClicked(target, register, count);
    expectEmissionCalls(target, count);
    applyClicked(target, remove, count);
    expectEmissionCalls(target, 0);
};

describe("on/off", () => {
    it("registers and removes handlers via callback identity", () => {
        expectRemovableHandlerNeverFires(onClicked);
    });

    it("returns this for chaining", () => {
        expectRegisterReturnsButton(onClicked);
    });

    it("off() after the handler was already disconnected leaves the signal reusable", () => {
        const target = createClickedTarget();
        onClicked(target.button, target.handler);
        applyClicked(target, offClicked, 2);
        expectEmissionCalls(target, 0);
        onClicked(target.button, target.handler);
        expectEmissionCalls(target, 1);
    });

    it.each([2, 3, 5])("removes every connection when the same handler was registered %i times", (count) => {
        expectBalancedRegistrationsLeaveNothingConnected(onClicked, offClicked, count);
    });

    it("removes exactly one connection per off() call", () => {
        const target = createClickedTarget();
        applyClicked(target, onClicked, 3);

        for (const remaining of [2, 1, 0]) {
            offClicked(target.button, target.handler);
            expectEmissionCalls(target, remaining);
        }
    });

    it("stays disconnected when off() is called more often than on()", () => {
        const target = createClickedTarget();
        applyClicked(target, onClicked, 2);
        applyClicked(target, offClicked, 2);
        expectEmissionCalls(target, 0);
        applyClicked(target, offClicked, 10);
        expectEmissionCalls(target, 0);
    });

    it("removes every connection of a detail signal the same handler was registered on twice", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        button.on("notify::label", handler);
        button.on("notify::label", handler);
        button.off("notify::label", handler);
        button.off("notify::label", handler);
        handler.mockClear();
        button.setLabel("changed");
        expect(handler).not.toHaveBeenCalled();
    });
});

describe("once", () => {
    it("can be removed via off() before firing", () => {
        expectRemovableHandlerNeverFires(onceClicked);
    });

    it("returns this for chaining", () => {
        expectRegisterReturnsButton(onceClicked);
    });

    it("leaves an on() connection of the same handler removable", () => {
        const target = createClickedTarget();
        onClicked(target.button, target.handler);
        onceClicked(target.button, target.handler);
        applyClicked(target, offClicked, 2);
        expectEmissionCalls(target, 0);
    });

    it("leaves no stale connection behind once it has fired", () => {
        const target = createClickedTarget();
        onceClicked(target.button, target.handler);
        expectEmissionCalls(target, 1);
        applyClicked(target, onClicked, 2);
        applyClicked(target, offClicked, 2);
        expectEmissionCalls(target, 0);
    });
});

describe("disconnect", () => {
    it("disconnects a handler by ID", () => {
        const target = createClickedTarget();
        const handlerId = target.button.connect("clicked", target.handler);
        expect(handlerId).toBeGreaterThan(0);
        expectEmissionCalls(target, 1);
        target.button.disconnect(handlerId);
        expectEmissionCalls(target, 0);
    });
});

describe("addEventListener/removeEventListener", () => {
    it("registers a handler that fires on emission", () => {
        const target = createClickedTarget();
        addClickedListener(target.button, target.handler);
        expectEmissionCalls(target, 1);
        removeClickedListener(target.button, target.handler);
    });

    it("registers and removes handlers via callback identity", () => {
        expectRemovableHandlerNeverFires(addClickedListener);
    });

    it("returns this for chaining", () => {
        expectRegisterReturnsButton(addClickedListener);
    });

    it.each([2, 3])("removes every connection when the same handler was registered %i times", (count) => {
        expectBalancedRegistrationsLeaveNothingConnected(addClickedListener, removeClickedListener, count);
    });

    it("removeEventListener removes a handler registered with on()", () => {
        const target = createClickedTarget();
        onClicked(target.button, target.handler);
        removeClickedListener(target.button, target.handler);
        expectEmissionCalls(target, 0);
    });
});
