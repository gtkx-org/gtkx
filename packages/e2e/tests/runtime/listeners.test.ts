import type { Object as GObject } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it, type Mock, vi } from "vitest";

type ClickedHandler = () => void;
type RegisterClicked = (button: Gtk.Button, handler: ClickedHandler) => GObject;
type ButtonWithHandler = { button: Gtk.Button; handler: Mock<ClickedHandler> };

const chainingHandler = vi.fn();
const disconnectedHandler = vi.fn();

const createButtonWithHandler = (): ButtonWithHandler => ({ button: new Gtk.Button(), handler: vi.fn() });

const expectRemovableHandlerNeverFires = (register: RegisterClicked): void => {
    const { button, handler } = createButtonWithHandler();
    register(button, handler);
    button.off("clicked", handler);
    expect(handler).not.toHaveBeenCalled();
};

const expectRegisterReturnsButton = (register: RegisterClicked): void => {
    const button = new Gtk.Button();
    const result = register(button, chainingHandler);
    expect(result).toBe(button);
    button.off("clicked", chainingHandler);
};

const repeatClicked = (operation: RegisterClicked, count: number): RegisterClicked[] =>
    Array.from({ length: count }, () => operation);

const applyClicked = (button: Gtk.Button, handler: ClickedHandler, operations: RegisterClicked[]): void => {
    for (const operation of operations) {
        operation(button, handler);
    }
};

const expectEmissionCalls = (button: Gtk.Button, handler: Mock<ClickedHandler>, expected: number): void => {
    handler.mockClear();
    button.emit("clicked");
    expect(handler).toHaveBeenCalledTimes(expected);
};

const expectCallsAfterRemoval = (
    registrations: RegisterClicked[],
    removals: RegisterClicked[],
    expected: number,
): void => {
    const { button, handler } = createButtonWithHandler();
    applyClicked(button, handler, registrations);
    applyClicked(button, handler, removals);
    expectEmissionCalls(button, handler, expected);
};

const expectBalancedRegistrationsLeaveNothingConnected = (
    register: RegisterClicked,
    remove: RegisterClicked,
    count: number,
): void => {
    const { button, handler } = createButtonWithHandler();
    applyClicked(button, handler, repeatClicked(register, count));
    expectEmissionCalls(button, handler, count);
    applyClicked(button, handler, repeatClicked(remove, count));
    expectEmissionCalls(button, handler, 0);
};

const onClicked: RegisterClicked = (button, handler) => button.on("clicked", handler);
const onceClicked: RegisterClicked = (button, handler) => button.once("clicked", handler);
const offClicked: RegisterClicked = (button, handler) => button.off("clicked", handler);
const addClickedListener: RegisterClicked = (button, handler) => button.addEventListener("clicked", handler);
const removeClickedListener: RegisterClicked = (button, handler) => button.removeEventListener("clicked", handler);

describe("on/off", () => {
    it("registers and removes handlers via callback identity", () => {
        expectRemovableHandlerNeverFires(onClicked);
    });

    it("returns this for chaining", () => {
        expectRegisterReturnsButton(onClicked);
    });

    it("off() after the handler was already disconnected is a no-op", () => {
        const button = new Gtk.Button();
        button.on("clicked", disconnectedHandler);
        button.off("clicked", disconnectedHandler);
        expect(() => button.off("clicked", disconnectedHandler)).not.toThrow();
    });

    it.each([2, 3, 5])("removes every connection when the same handler was registered %i times", (count) => {
        expectBalancedRegistrationsLeaveNothingConnected(onClicked, offClicked, count);
    });

    it("removes one connection per off() call", () => {
        expectCallsAfterRemoval([onClicked, onClicked], [offClicked], 1);
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
        expectCallsAfterRemoval([onClicked, onceClicked], [offClicked, offClicked], 0);
    });
});

describe("disconnect", () => {
    it("disconnects a handler by ID", () => {
        const button = new Gtk.Button();
        const handlerId = button.connect("clicked", vi.fn());
        expect(typeof handlerId).toBe("number");
        expect(handlerId).toBeGreaterThan(0);

        expect(() => {
            button.disconnect(handlerId);
        }).not.toThrow();
    });
});

describe("addEventListener/removeEventListener", () => {
    it("registers a handler that fires on emission", () => {
        expectCallsAfterRemoval([addClickedListener], [], 1);
    });

    it("registers and removes handlers via callback identity", () => {
        expectRemovableHandlerNeverFires(addClickedListener);
    });

    it("returns this for chaining", () => {
        expectRegisterReturnsButton(addClickedListener);
    });

    it("removes every connection when the same handler was registered twice", () => {
        expectBalancedRegistrationsLeaveNothingConnected(addClickedListener, removeClickedListener, 2);
    });

    it("removeEventListener removes a handler registered with on()", () => {
        expectCallsAfterRemoval([onClicked], [removeClickedListener], 0);
    });
});
