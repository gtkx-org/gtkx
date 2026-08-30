import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";

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
    it("happy path", () => {
        const { window, seen } = constructObserved(() => new Gtk.Window({ title: "Observed" }));
        expect(window).toBe(seen);
        expect(window.getTitle()).toBe("Observed");
        window.destroy();
    });

    it("edge cases", async () => {
        const label = new Gtk.Label();
        let seen: unknown = null;

        label.connect("notify::parent", () => {
            seen = label.getParent();
        });

        const window = new Gtk.Window({ child: label });
        expect(window).toBe(seen);
        expect(window.getChild()).toBe(label);
        window.destroy();

        const { window: observed, seen: observedDuringConstruction } = constructObserved(() => new ObservedWindow());
        expect(observed).toBe(observedDuringConstruction);
        expect(observed).toBeInstanceOf(ObservedWindow);
        observed.destroy();

        const weak = detachObservedWindow();
        await gcUntil(() => weak.deref() === undefined);
        expect(weak.deref()).toBeUndefined();
    });

    it("error paths", () => {
        expect(() => constructObserved(() => new Gtk.Window({ title: Symbol("title") as never }))).toThrow();
    });
});
