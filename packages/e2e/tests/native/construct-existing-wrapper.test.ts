import * as Gtk from "@gtkx/gi/gtk";
import { getHandle, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { gcUntil, getRefCount } from "../helpers/native-utils.js";

type ObservedConstruction<T extends Gtk.Window> = { window: T; seen: unknown };

const constructObserved = <T extends Gtk.Window>(construct: () => T): ObservedConstruction<T> => {
    const toplevels = Gtk.Window.getToplevels();
    let seen: unknown = null;

    const observe = (position: number, _removed: number, added: number): void => {
        if (added > 0) {
            seen = toplevels.getItem(position);
        }
    };

    toplevels.on("items-changed", observe);

    try {
        return { window: construct(), seen };
    } finally {
        toplevels.off("items-changed", observe);
    }
};

const detachObservedWindow = (): WeakRef<object> => {
    const { window } = constructObserved(() => new Gtk.Window());
    window.destroy();

    return new WeakRef(window);
};

class ObservedWindow extends Gtk.Window {}

registerClass(ObservedWindow, { typeName: "GtkxTestObservedWindow" });

describe("constructing an object wrapped during construction", () => {
    it("returns the wrapper created inside a toplevels items-changed handler", () => {
        const { window, seen } = constructObserved(() => new Gtk.Window());
        expect(seen).not.toBeNull();
        expect(window).toBe(seen);
        window.setTitle("Adopted");
        expect(window.getTitle()).toBe("Adopted");
        window.destroy();
    });

    it("applies the construct properties to the adopted wrapper", () => {
        const { window, seen } = constructObserved(() => new Gtk.Window({ title: "Observed" }));
        expect(window).toBe(seen);
        expect(window.getTitle()).toBe("Observed");
        window.destroy();
    });

    it("adopts the wrapper created from a property notify during construction", () => {
        const label = new Gtk.Label();
        let seen: unknown = null;

        label.connect("notify::parent", () => {
            seen = label.getParent();
        });

        const window = new Gtk.Window({ child: label });
        expect(window).toBe(seen);
        expect(window.getChild()).toBe(label);
        window.destroy();
    });

    it("keeps a registered subclass bound to the wrapper it claimed", () => {
        const { window, seen } = constructObserved(() => new ObservedWindow());
        expect(window).toBe(seen);
        expect(window).toBeInstanceOf(ObservedWindow);
        window.destroy();
    });

    it("holds the same reference count as an unobserved window", () => {
        const control = new Gtk.Window();
        const { window } = constructObserved(() => new Gtk.Window());
        expect(getRefCount(getHandle(window))).toBe(getRefCount(getHandle(control)));
        window.destroy();
        control.destroy();
    });

    it("releases the adopted wrapper after the window is destroyed", async () => {
        const weak = detachObservedWindow();
        await gcUntil(() => weak.deref() === undefined);
        expect(weak.deref()).toBeUndefined();
    });

    it("rejects a construct property it cannot marshal while observed", () => {
        expect(() => constructObserved(() => new Gtk.Window({ title: Symbol("title") as never }))).toThrow();
    });
});
