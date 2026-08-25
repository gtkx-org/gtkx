import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import { TYPE_INT, Value } from "@gtkx/gi/gobject";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    fromValue,
    getHandle,
    type JsValue,
    TYPE_BOOLEAN,
    TYPE_DOUBLE,
    TYPE_INT64,
    TYPE_POINTER,
    TYPE_STRING,
    TYPE_UINT64,
    typeFromName,
    ValueMarshalError,
} from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const heldType = (value: JsValue): bigint => Gtk.ConstantExpression.newForValue(value).getValueType();

const held = (value: JsValue): unknown => {
    const out = new Value();
    Gtk.ConstantExpression.newForValue(value).evaluate(null, out);

    return fromValue(getHandle(out));
};

const createConstant = (value: JsValue): Gtk.ConstantExpression => Gtk.ConstantExpression.newForValue(value);

const createConstantForUncheckedValue = (value: unknown): void => {
    Reflect.apply(createConstant, undefined, [value]);
};

const makeRgba = (red: number, green: number, blue: number): Gdk.RGBA =>
    new (Gdk.RGBA as new (props: object) => Gdk.RGBA)({ red, green, blue, alpha: 1 });

describe("a JavaScript value passed where a GObject.Value is expected", () => {
    it("holds a string as gchararray", () => {
        expect(heldType("hello")).toBe(TYPE_STRING);
        expect(held("hello")).toBe("hello");
    });

    it("holds a boolean as gboolean", () => {
        expect(heldType(true)).toBe(TYPE_BOOLEAN);
        expect(held(true)).toBe(true);
    });

    it("holds an integer as gint", () => {
        expect(heldType(42)).toBe(TYPE_INT);
        expect(held(42)).toBe(42);
    });

    it("holds a fractional number as gdouble", () => {
        expect(heldType(2.5)).toBe(TYPE_DOUBLE);
        expect(held(2.5)).toBe(2.5);
    });

    it("holds a bigint as gint64", () => {
        expect(heldType(-10n)).toBe(TYPE_INT64);
        expect(held(-10n)).toBe(-10n);
    });

    it("holds a bigint past the signed range as guint64", () => {
        expect(heldType(2n ** 63n)).toBe(TYPE_UINT64);
        expect(held(2n ** 63n)).toBe(2n ** 63n);
    });

    it("holds null as a NULL gpointer, the way GJS does", () => {
        expect(heldType(null)).toBe(TYPE_POINTER);
        expect(held(null)).toBeNull();
    });

    it("holds an array of strings as GStrv", () => {
        expect(heldType(["one", "two"])).toBe(typeFromName("GStrv"));
        expect(held(["one", "two"])).toEqual(["one", "two"]);
    });
});

describe("a wrapper instance passed where a GObject.Value is expected", () => {
    it("holds an object as its own GType", () => {
        const label = new Gtk.Label({ label: "text" });
        expect(heldType(label)).toBe(typeFromName("GtkLabel"));
        expect(held(label)).toBe(label);
    });

    it("holds a boxed instance as its own GType", () => {
        const rgba = makeRgba(0.5, 0.25, 0.75);
        expect(heldType(rgba)).toBe(typeFromName("GdkRGBA"));
        expect(held(rgba)).toBeInstanceOf(Gdk.RGBA);
    });

    it("holds a variant as GVariant", () => {
        const variant = GLib.Variant.newString("packed");
        expect(heldType(variant)).toBe(typeFromName("GVariant"));
        expect(held(variant)).toBeInstanceOf(GLib.Variant);
    });

    it("holds the concrete GType of an instance reached through an interface", () => {
        expect(heldType(Gtk.WidgetPaintable.new(null))).toBe(typeFromName("GtkWidgetPaintable"));
    });
});

describe("a value built before the call", () => {
    it("passes through unchanged", () => {
        const value = new Value();
        value.init(TYPE_DOUBLE);
        value.setDouble(0.5);
        expect(heldType(value)).toBe(TYPE_DOUBLE);
        expect(held(value)).toBe(0.5);
    });

    it("reaches a GType inference cannot name", () => {
        const value = new Value();
        value.init(GObject.TYPE_UCHAR);
        value.setUchar(200);
        expect(heldType(value)).toBe(GObject.TYPE_UCHAR);
        expect(held(value)).toBe(200);
    });
});

describe("the GType inferred from a number or an array", () => {
    it("is gint at the bounds of the signed 32-bit range", () => {
        expect(heldType(-2_147_483_648)).toBe(TYPE_INT);
        expect(heldType(2_147_483_647)).toBe(TYPE_INT);
    });

    it("is gdouble for a whole number past the signed 32-bit range", () => {
        expect(heldType(2_147_483_648)).toBe(TYPE_DOUBLE);
        expect(heldType(-2_147_483_649)).toBe(TYPE_DOUBLE);
    });

    it("is gdouble for a number holding no finite value", () => {
        expect(heldType(NaN)).toBe(TYPE_DOUBLE);
        expect(heldType(Infinity)).toBe(TYPE_DOUBLE);
    });

    it("is gint64 and guint64 at the bounds of the 64-bit range", () => {
        expect(heldType(-(2n ** 63n))).toBe(TYPE_INT64);
        expect(held(-(2n ** 63n))).toBe(-(2n ** 63n));
        expect(heldType(2n ** 64n - 1n)).toBe(TYPE_UINT64);
        expect(held(2n ** 64n - 1n)).toBe(2n ** 64n - 1n);
    });

    it("is GStrv for an empty array", () => {
        expect(heldType([])).toBe(typeFromName("GStrv"));
        expect(held([])).toEqual([]);
    });
});

describe("a value no GType can be inferred from", () => {
    it("throws for undefined", () => {
        expect(() => {
            createConstantForUncheckedValue(undefined);
        }).toThrow(ValueMarshalError);
    });

    it("throws for a function", () => {
        expect(() => {
            createConstantForUncheckedValue(() => 0);
        }).toThrow(ValueMarshalError);
    });

    it("throws for an array holding anything but strings", () => {
        expect(() => {
            createConstantForUncheckedValue([1, 2]);
        }).toThrow(ValueMarshalError);
    });

    it("throws for a bigint below the signed 64-bit range", () => {
        expect(() => Gtk.ConstantExpression.newForValue(-(2n ** 63n) - 1n)).toThrow(ValueMarshalError);
    });

    it("throws for a bigint above the unsigned 64-bit range", () => {
        expect(() => Gtk.ConstantExpression.newForValue(2n ** 64n)).toThrow(ValueMarshalError);
    });

    it("throws for an array with holes in it", () => {
        const sparse: string[] = ["one"];
        sparse.length = 3;
        expect(() => Gtk.ConstantExpression.newForValue(sparse)).toThrow(ValueMarshalError);
    });

    it("throws for a plain object", () => {
        expect(() => {
            createConstantForUncheckedValue({});
        }).toThrow(ValueMarshalError);
    });
});

describe("a binding handing a value back", () => {
    it("surfaces what a caller-allocated out parameter holds", () => {
        const builder = new Gtk.Builder();
        expect(builder.valueFromStringType(TYPE_INT, "42")).toEqual([true, 42]);
    });

    it("surfaces what a value read back from the clipboard holds", async () => {
        const display = Gdk.Display.getDefault();

        if (display === null) {
            throw new Error("reading the clipboard back needs a display");
        }

        const clipboard = display.getClipboard();
        clipboard.set("copied");
        expect(await clipboard.readValueAsync(TYPE_STRING, 0, null)).toBe("copied");
    });

    it("surfaces null for a value holding nothing", () => {
        const target = Gtk.DropTarget.new(TYPE_STRING, Gdk.DragAction.COPY);
        expect(target.getValue()).toBeNull();
    });
});

describe("a value passed to a signal emission", () => {
    it("infers a GType the same way a parameter does", () => {
        const target = Gtk.DropTarget.new(TYPE_STRING, Gdk.DragAction.COPY);
        const received: unknown[] = [];

        target.on("drop", (value) => {
            received.push(value.getString());

            return true;
        });

        expect(target.emit("drop", "dropped", 0, 0)).toBe(true);
        expect(received).toEqual(["dropped"]);
    });

    it("takes an already-built value", () => {
        const target = Gtk.DropTarget.new(TYPE_STRING, Gdk.DragAction.COPY);
        const received: unknown[] = [];

        target.on("drop", (value) => {
            received.push(value.getString());

            return true;
        });

        const built = new Value();
        built.init(TYPE_STRING);
        built.setString("built");
        expect(target.emit("drop", built, 0, 0)).toBe(true);
        expect(received).toEqual(["built"]);
    });
});
