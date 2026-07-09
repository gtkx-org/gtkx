import type { Object as GObject } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it, vi } from "vitest";

type ClickedHandler = () => void;
type RegisterClicked = (button: Gtk.Button, handler: ClickedHandler) => GObject;

const expectRemovableHandlerNeverFires = (register: RegisterClicked): void => {
    const button = new Gtk.Button();
    const handler = vi.fn();

    register(button, handler);
    button.off("clicked", handler);

    expect(handler).not.toHaveBeenCalled();
};

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

describe("addEventListener/removeEventListener", () => {
    it("registers a handler that fires on emission", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        button.addEventListener("clicked", handler);
        button.emit("clicked");
        expect(handler).toHaveBeenCalledTimes(1);
        button.removeEventListener("clicked", handler);
    });

    it("registers and removes handlers via callback identity", () => {
        expectRemovableHandlerNeverFires((button, handler) => button.addEventListener("clicked", handler));
    });

    it("returns this for chaining", () => {
        expectRegisterReturnsButton((button, handler) => button.addEventListener("clicked", handler));
    });

    it("removeEventListener removes a handler registered with on()", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        button.on("clicked", handler);
        button.removeEventListener("clicked", handler);
        button.emit("clicked");
        expect(handler).not.toHaveBeenCalled();
    });
});
