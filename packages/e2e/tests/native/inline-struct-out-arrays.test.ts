import type * as Pango from "@gtkx/gi/pango";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

const TEXT = "hello world";

const requireDisplay = (): Gdk.Display => {
    const display = Gdk.Display.getDefault();

    if (display === null) {
        throw new Error("The tests need a default GdkDisplay");
    }

    return display;
};

const textLayout = (): Pango.Layout => new Gtk.Label({ label: TEXT }).getLayout();

describe("out arrays of inline structs sized by a second out parameter", () => {
    it("reads each GdkKeymapKey at its own stride", () => {
        const display = requireDisplay();
        const [hasKeys, keys] = display.mapKeyval(Gdk.KEY_a);
        expect(hasKeys).toBe(true);
        expect(keys.length).toBeGreaterThan(0);

        for (const key of keys) {
            expect(key.keycode).toBeGreaterThan(0);
            expect(key.group).toBeGreaterThanOrEqual(0);
            expect(key.level).toBeGreaterThanOrEqual(0);
        }
    });

    it("maps a keycode back to the keyval it came from", () => {
        const display = requireDisplay();
        const [, keys] = display.mapKeyval(Gdk.KEY_a);
        const [first] = keys;

        if (first === undefined) {
            throw new Error("The keymap reported no key for GDK_KEY_a");
        }

        const [hasEntries, entries, keyvals] = display.mapKeycode(first.keycode);
        expect(hasEntries).toBe(true);
        expect(keyvals).toContain(Gdk.KEY_a);
        expect(entries).toHaveLength(keyvals.length);
        expect(entries.map((entry) => entry.keycode)).toEqual(entries.map(() => first.keycode));

        expect(new Set(entries.map((entry) => `${String(entry.group)}:${String(entry.level)}`))).toHaveProperty(
            "size",
            entries.length,
        );
    });

    it("reads a PangoLogAttr per character position", () => {
        const attrs = textLayout().getLogAttrs();
        expect(attrs).toHaveLength(TEXT.length + 1);
        expect(attrs.map((attr) => attr.isWordStart)).toEqual([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
        expect(attrs.map((attr) => attr.isWhite)).toEqual([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
    });

    it("agrees with the borrowed-array reader", () => {
        const layout = textLayout();

        expect(layout.getLogAttrsReadonly().map((attr) => attr.isCursorPosition)).toEqual(
            layout.getLogAttrs().map((attr) => attr.isCursorPosition),
        );
    });
});
