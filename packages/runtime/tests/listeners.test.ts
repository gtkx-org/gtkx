import type { Object as GObject } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

type ClickedHandler = () => void;
type RegisterClicked = (button: Gtk.Button, handler: ClickedHandler) => GObject;
type ClickedTarget = { button: Gtk.Button; handler: ClickedHandler; calls: () => number };

const onClicked: RegisterClicked = (button, handler) => button.on("clicked", handler);
const onceClicked: RegisterClicked = (button, handler) => button.once("clicked", handler);
const offClicked: RegisterClicked = (button, handler) => button.off("clicked", handler);
const createClickedTarget = (): ClickedTarget => {
    let calls = 0;

    return {
        button: new Gtk.Button(),
        handler: () => {
            calls += 1;
        },
        calls: () => calls,
    };
};

const applyClicked = (target: ClickedTarget, operation: RegisterClicked, count: number): void => {
    for (let index = 0; index < count; index += 1) {
        operation(target.button, target.handler);
    }
};

const expectEmissionCalls = (target: ClickedTarget, expected: number): void => {
    const previousCalls = target.calls();
    target.button.emit("clicked");
    expect(target.calls() - previousCalls).toBe(expected);
};

const expectRemovableHandlerNeverFires = (register: RegisterClicked): void => {
    const target = createClickedTarget();
    register(target.button, target.handler);
    offClicked(target.button, target.handler);
    expectEmissionCalls(target, 0);
};

const expectRegisterReturnsButton = (register: RegisterClicked): void => {
    const { button, handler } = createClickedTarget();
    const result = register(button, handler);
    expect(result).toBe(button);
    button.off("clicked", handler);
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
        let calls = 0;
        const handler = (): void => {
            calls += 1;
        };
        button.on("notify::label", handler);
        button.on("notify::label", handler);
        button.setLabel("initial");
        expect(calls).toBe(2);
        button.off("notify::label", handler);
        button.off("notify::label", handler);
        button.setLabel("changed");
        expect(calls).toBe(2);
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
