import type { Object as GObject } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it, vi } from "vitest";

type ClickedHandler = () => void;
type RegisterClicked = (button: Gtk.Button, handler: ClickedHandler) => GObject;

/**
 * Asserts that a handler registered with `register` and immediately removed via
 * `off` never fires for the `clicked` signal of a fresh button.
 *
 * @param register - Registers the handler on the button and returns the button
 */
const expectRemovableHandlerNeverFires = (register: RegisterClicked): void => {
    const button = new Gtk.Button();
    const handler = vi.fn();

    register(button, handler);
    button.off("clicked", handler);

    expect(handler).not.toHaveBeenCalled();
};

/**
 * Asserts that `register` returns the button it registered on, enabling method
 * chaining, then removes the handler again.
 *
 * @param register - Registers the handler on the button and returns the button
 */
const expectRegisterReturnsButton = (register: RegisterClicked): void => {
    const button = new Gtk.Button();
    const handler = (): void => {};
    const result = register(button, handler);
    expect(result).toBe(button);
    button.off("clicked", handler);
};

describe("on/off", () => {
    it("registers and removes handlers via callback identity", () => {
        expectRemovableHandlerNeverFires((button, handler) => button.on("clicked", handler));
    });

    it("returns this for chaining", () => {
        expectRegisterReturnsButton((button, handler) => button.on("clicked", handler));
    });

    it("off() after the handler was already disconnected is a no-op", () => {
        const button = new Gtk.Button();
        const handler = (): void => {};
        button.on("clicked", handler);
        button.off("clicked", handler);
        expect(() => button.off("clicked", handler)).not.toThrow();
    });
});

describe("once", () => {
    it("can be removed via off() before firing", () => {
        expectRemovableHandlerNeverFires((button, handler) => button.once("clicked", handler));
    });

    it("returns this for chaining", () => {
        expectRegisterReturnsButton((button, handler) => button.once("clicked", handler));
    });
});

describe("disconnect", () => {
    it("disconnects a handler by ID", () => {
        const button = new Gtk.Button();
        const handlerId = button.connect("clicked", () => {});
        expect(typeof handlerId).toBe("number");
        expect(handlerId).toBeGreaterThan(0);
        expect(() => button.disconnect(handlerId)).not.toThrow();
    });
});
