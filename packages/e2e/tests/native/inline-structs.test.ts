import * as Gdk from "@gtkx/gi/gdk";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { describe, expect, it } from "vitest";

const TEXT = "hello world";

const unitRect = (): Graphene.Rect => {
    const rect = new Graphene.Rect();
    rect.init(1, 2, 3, 4);

    return rect;
};

const requireDisplay = (): Gdk.Display => {
    const display = Gdk.Display.getDefault();

    if (display === null) {
        throw new Error("The tests need a default GdkDisplay");
    }

    return display;
};

const textLayout = (): Pango.Layout => new Gtk.Label({ label: TEXT }).getLayout();

describe("inline struct fields", () => {
    it("writes a nested boxed or plain struct field through its owner, keeping it aliased", () => {
        const rect = unitRect();
        rect.origin.x = 99;
        rect.size.width = 77;
        expect(rect.origin.x).toBe(99);
        expect(rect.size.width).toBe(77);
        const origin = rect.origin;
        origin.y = 42;
        expect(rect.origin.y).toBe(42);
        expect(rect.getY()).toBe(42);
        const info = new Pango.GlyphInfo();
        info.geometry.width = 1234;
        info.geometry.xOffset = -8;
        expect(info.geometry.width).toBe(1234);
        expect(info.geometry.xOffset).toBe(-8);
    });

    it("replaces a nested field wholesale, and leaves it intact when written back from its own alias", () => {
        const aliased = unitRect();
        const alias = aliased.origin;
        aliased.origin = alias;
        expect(aliased.origin.x).toBe(1);
        expect(aliased.origin.y).toBe(2);
        const replaced = unitRect();
        const point = new Graphene.Point();
        point.init(50, 60);
        replaced.origin = point;
        expect(replaced.origin.x).toBe(50);
        point.init(0, 0);
        expect(replaced.origin.x).toBe(50);
        expect(replaced.origin.y).toBe(60);
    });
});

describe("out arrays of inline structs sized by a second out parameter", () => {
    it("reads each GdkKeymapKey at its own stride and maps a keycode back to its keyval", () => {
        const display = requireDisplay();
        const [hasKeys, keys] = display.mapKeyval(Gdk.KEY_a);
        expect(hasKeys).toBe(true);
        expect(keys.length).toBeGreaterThan(0);

        for (const key of keys) {
            expect(key.keycode).toBeGreaterThan(0);
            expect(key.group).toBeGreaterThanOrEqual(0);
            expect(key.level).toBeGreaterThanOrEqual(0);
        }

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

    it("reads a PangoLogAttr per character position, agreeing with the borrowed-array reader", () => {
        const layout = textLayout();
        const attrs = layout.getLogAttrs();
        expect(attrs).toHaveLength(TEXT.length + 1);
        expect(attrs.map((attr) => attr.isWordStart)).toEqual([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
        expect(attrs.map((attr) => attr.isWhite)).toEqual([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]);

        expect(layout.getLogAttrsReadonly().map((attr) => attr.isCursorPosition)).toEqual(
            attrs.map((attr) => attr.isCursorPosition),
        );
    });
});
