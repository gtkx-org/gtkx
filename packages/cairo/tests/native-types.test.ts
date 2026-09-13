import * as cairo from "@gtkx/cairo";
import * as GObject from "@gtkx/gi/gobject";
import { type ExternalObject, type Handle, resolveType, t, wrapHandle } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const getEnumClass = t.bind(
    "libgobject-2.0.so.0",
    "g_type_class_get",
    [t.gtype],
    t.struct("borrowed", { size: 32 }),
);

const enums = {
    Status: "status",
    Content: "content",
    Operator: "operator",
    Antialias: "antialias",
    FillRule: "fill_rule",
    LineCap: "line_cap",
    LineJoin: "line_join",
    FontSlant: "font_slant",
    FontWeight: "font_weight",
    SubpixelOrder: "subpixel_order",
    HintStyle: "hint_style",
    HintMetrics: "hint_metrics",
    FontType: "font_type",
    PathDataType: "path_data_type",
    DeviceType: "device_type",
    SurfaceType: "surface_type",
    Format: "format",
    PatternType: "pattern_type",
    Extend: "extend",
    Filter: "filter",
    RegionOverlap: "region_overlap",
} as const;

describe("native Cairo enum values", () => {
    it.each(Object.entries(enums))("exports the native values of %s", (name, symbol) => {
        const nativeType = resolveType("libcairo-gobject.so.2", `cairo_gobject_${symbol}_get_type`);
        const nativeClass = wrapHandle(getEnumClass(nativeType) as ExternalObject<Handle>, GObject.EnumClass);

        const values = Object.fromEntries(nativeClass.values
            .filter((value) => value.valueNick !== "last-status")
            .map((value) => [value.valueNick.toUpperCase().replaceAll("-", "_"), value.value]));

        expect(cairo[name as keyof typeof enums]).toEqual(expect.objectContaining(values));
    });
});

describe("Cairo structs", () => {
    it("round-trips rectangle, glyph and text-cluster fields", () => {
        expect(new cairo.Rectangle({ x: 1.5, y: 2.5, width: 3.5, height: 4.5 })).toMatchObject({
            x: 1.5,
            y: 2.5,
            width: 3.5,
            height: 4.5,
        });

        expect(new cairo.RectangleInt({ x: 1, y: 2, width: 3, height: 4 })).toMatchObject({
            x: 1,
            y: 2,
            width: 3,
            height: 4,
        });
        expect(new cairo.Glyph({ index: 1n, x: 2.5, y: 3.5 })).toMatchObject({ index: 1n, x: 2.5, y: 3.5 });
        expect(new cairo.TextCluster({ numBytes: 2, numGlyphs: 1 })).toMatchObject({ numBytes: 2, numGlyphs: 1 });
    });

    it("leaves the fields of a struct constructed without props at zero", () => {
        const rect = new cairo.RectangleInt();
        expect([rect.x, rect.y, rect.width, rect.height]).toEqual([0, 0, 0, 0]);
        expect(new cairo.Glyph().index).toBe(0n);
    });

    it("treats a null prop the same as one left out", () => {
        const rect = new cairo.Rectangle({ x: null, width: 5 });
        expect([rect.x, rect.width]).toEqual([0, 5]);
        expect(new cairo.Glyph({ index: null }).index).toBe(0n);
    });

    it("writes back through the setters", () => {
        const rect = new cairo.Rectangle({ x: 1.5 });
        rect.width = 2.5;
        expect(rect.x).toBe(1.5);
        expect(rect.width).toBe(2.5);
    });

    it("throws when a struct field receives a non-numeric value", () => {
        expect(() => new cairo.RectangleInt({ x: "wide" as never })).toThrow();
        expect(() => new cairo.Glyph({ index: "first" as never })).toThrow();
    });
});
