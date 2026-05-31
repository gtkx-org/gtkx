import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    allocRectangle,
    allocRgba,
    expectRectangleFields,
    readRectangleFields,
    readRgbaChannels,
    writeRectangleFields,
    writeRgbaChannels,
} from "../call-boxed-alloc-setup.js";
import { BOOLEAN, GDK_LIB, INT32, PANGO_LIB, STRING, STRING_BORROWED, startMemoryMeasurement, VOID } from "../utils.js";

const RGBA_BOXED_NONE = { type: "boxed" as const, innerType: "GdkRGBA", lib: GDK_LIB, ownership: "borrowed" as const };
const RECTANGLE_BOXED_NONE = {
    type: "boxed" as const,
    innerType: "GdkRectangle",
    lib: GDK_LIB,
    ownership: "borrowed" as const,
};
const PANGO_FONT_DESC = {
    type: "boxed" as const,
    innerType: "PangoFontDescription",
    lib: PANGO_LIB,
    ownership: "full" as const,
};
const PANGO_FONT_DESC_NONE = {
    type: "boxed" as const,
    innerType: "PangoFontDescription",
    lib: PANGO_LIB,
    ownership: "borrowed" as const,
};

describe("call - boxed types - GdkRGBA basic", () => {
    it("creates RGBA boxed type via alloc", () => {
        const rgba = allocRgba();

        expect(rgba).toBeDefined();

        writeRgbaChannels(rgba, { red: 1.0, green: 0.0, blue: 0.0, alpha: 1.0 });

        const channels = readRgbaChannels(rgba);

        expect(channels.red).toBeCloseTo(1.0);
        expect(channels.green).toBeCloseTo(0.0);
        expect(channels.blue).toBeCloseTo(0.0);
        expect(channels.alpha).toBeCloseTo(1.0);
    });

    it("parses RGBA from string", () => {
        const rgba = allocRgba();

        const success = call(
            GDK_LIB,
            "gdk_rgba_parse",
            [
                { type: RGBA_BOXED_NONE, value: rgba },
                { type: STRING, value: "rgb(255, 128, 0)" },
            ],
            BOOLEAN,
        );

        expect(success).toBe(true);

        const channels = readRgbaChannels(rgba);

        expect(channels.red).toBeCloseTo(1.0);
        expect(channels.green).toBeCloseTo(0.5, 1);
        expect(channels.blue).toBeCloseTo(0.0);
    });
});

describe("call - boxed types - GdkRGBA conversion", () => {
    it("converts RGBA to string", () => {
        const rgba = allocRgba();

        writeRgbaChannels(rgba, { red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });

        const result = call(GDK_LIB, "gdk_rgba_to_string", [{ type: RGBA_BOXED_NONE, value: rgba }], STRING);

        expect(typeof result).toBe("string");
        expect(result).toContain("rgb");
    });

    it("compares two RGBA values", () => {
        const rgba1 = allocRgba();
        const rgba2 = allocRgba();

        writeRgbaChannels(rgba1, { red: 1.0, green: 0.0, blue: 0.0, alpha: 1.0 });

        writeRgbaChannels(rgba2, { red: 1.0, green: 0.0, blue: 0.0, alpha: 1.0 });

        const equal = call(
            GDK_LIB,
            "gdk_rgba_equal",
            [
                { type: RGBA_BOXED_NONE, value: rgba1 },
                { type: RGBA_BOXED_NONE, value: rgba2 },
            ],
            BOOLEAN,
        );

        expect(equal).toBe(true);
    });
});

describe("call - boxed types - GdkRectangle basic", () => {
    it("creates rectangle boxed type", () => {
        const rect = allocRectangle();

        writeRectangleFields(rect, { x: 10, y: 20, width: 100, height: 50 });

        expectRectangleFields(rect, { x: 10, y: 20, width: 100, height: 50 });
    });
});

describe("call - boxed types - GdkRectangle intersection", () => {
    it("checks rectangle intersection", () => {
        const rect1 = allocRectangle();
        const rect2 = allocRectangle();
        const dest = allocRectangle();

        writeRectangleFields(rect1, { x: 0, y: 0, width: 100, height: 100 });

        writeRectangleFields(rect2, { x: 50, y: 50, width: 100, height: 100 });

        const intersects = call(
            GDK_LIB,
            "gdk_rectangle_intersect",
            [
                { type: RECTANGLE_BOXED_NONE, value: rect1 },
                { type: RECTANGLE_BOXED_NONE, value: rect2 },
                { type: RECTANGLE_BOXED_NONE, value: dest },
            ],
            BOOLEAN,
        );

        expect(intersects).toBe(true);

        const destFields = readRectangleFields(dest);

        expect(destFields.x).toBe(50);
        expect(destFields.y).toBe(50);
        expect(destFields.width).toBe(50);
        expect(destFields.height).toBe(50);
    });
});

describe("call - boxed types - GdkRectangle union", () => {
    it("computes rectangle union", () => {
        const rect1 = allocRectangle();
        const rect2 = allocRectangle();
        const dest = allocRectangle();

        writeRectangleFields(rect1, { x: 0, y: 0, width: 50, height: 50 });

        writeRectangleFields(rect2, { x: 50, y: 50, width: 50, height: 50 });

        call(
            GDK_LIB,
            "gdk_rectangle_union",
            [
                { type: RECTANGLE_BOXED_NONE, value: rect1 },
                { type: RECTANGLE_BOXED_NONE, value: rect2 },
                { type: RECTANGLE_BOXED_NONE, value: dest },
            ],
            VOID,
        );

        const destFields = readRectangleFields(dest);

        expect(destFields.width).toBe(100);
        expect(destFields.height).toBe(100);
    });
});

describe("call - boxed types - GdkRectangle contains", () => {
    it("checks if point is contained in rectangle", () => {
        const rect = allocRectangle();

        writeRectangleFields(rect, { x: 0, y: 0, width: 100, height: 100 });

        const containsInside = call(
            GDK_LIB,
            "gdk_rectangle_contains_point",
            [
                { type: RECTANGLE_BOXED_NONE, value: rect },
                { type: INT32, value: 50 },
                { type: INT32, value: 50 },
            ],
            BOOLEAN,
        );

        const containsOutside = call(
            GDK_LIB,
            "gdk_rectangle_contains_point",
            [
                { type: RECTANGLE_BOXED_NONE, value: rect },
                { type: INT32, value: 150 },
                { type: INT32, value: 150 },
            ],
            BOOLEAN,
        );

        expect(containsInside).toBe(true);
        expect(containsOutside).toBe(false);
    });
});

describe("call - boxed types - PangoFontDescription basic", () => {
    it("creates font description from string", () => {
        const fontDesc = call(
            PANGO_LIB,
            "pango_font_description_from_string",
            [{ type: STRING, value: "Sans 12" }],
            PANGO_FONT_DESC,
        );

        expect(fontDesc).toBeDefined();

        const family = call(
            PANGO_LIB,
            "pango_font_description_get_family",
            [{ type: PANGO_FONT_DESC_NONE, value: fontDesc }],
            STRING_BORROWED,
        );

        expect(family).toBe("Sans");
    });
});

describe("call - boxed types - PangoFontDescription size", () => {
    it("modifies font description size", () => {
        const fontDesc = call(
            PANGO_LIB,
            "pango_font_description_from_string",
            [{ type: STRING, value: "Sans 12" }],
            PANGO_FONT_DESC,
        );

        call(
            PANGO_LIB,
            "pango_font_description_set_size",
            [
                { type: PANGO_FONT_DESC_NONE, value: fontDesc },
                { type: INT32, value: 14 * 1024 },
            ],
            VOID,
        );

        const size = call(
            PANGO_LIB,
            "pango_font_description_get_size",
            [{ type: PANGO_FONT_DESC_NONE, value: fontDesc }],
            INT32,
        );

        expect(size).toBe(14 * 1024);
    });
});

describe("call - boxed types - PangoFontDescription conversion", () => {
    it("converts font description to string", () => {
        const fontDesc = call(
            PANGO_LIB,
            "pango_font_description_from_string",
            [{ type: STRING, value: "Serif Bold 16" }],
            PANGO_FONT_DESC,
        );

        const str = call(
            PANGO_LIB,
            "pango_font_description_to_string",
            [{ type: PANGO_FONT_DESC_NONE, value: fontDesc }],
            STRING,
        );

        expect(str).toContain("Serif");
        expect(str).toContain("Bold");
        expect(str).toContain("16");
    });
});

describe("call - boxed types - ownership", () => {
    it("handles owned boxed (caller manages)", () => {
        const fontDesc = call(
            PANGO_LIB,
            "pango_font_description_from_string",
            [{ type: STRING, value: "Monospace 10" }],
            PANGO_FONT_DESC,
        );

        expect(fontDesc).toBeDefined();

        const family = call(
            PANGO_LIB,
            "pango_font_description_get_family",
            [{ type: PANGO_FONT_DESC_NONE, value: fontDesc }],
            STRING_BORROWED,
        );

        expect(family).toBe("Monospace");
    });

    it("handles transfer none boxed correctly", () => {
        const rgba = allocRgba();

        call(
            GDK_LIB,
            "gdk_rgba_parse",
            [
                { type: RGBA_BOXED_NONE, value: rgba },
                { type: STRING, value: "blue" },
            ],
            BOOLEAN,
        );

        const str1 = call(GDK_LIB, "gdk_rgba_to_string", [{ type: RGBA_BOXED_NONE, value: rgba }], STRING);

        const str2 = call(GDK_LIB, "gdk_rgba_to_string", [{ type: RGBA_BOXED_NONE, value: rgba }], STRING);

        expect(str1).toBe(str2);
    });
});

describe("call - boxed types - memory leaks RGBA", () => {
    it("does not leak when creating many boxed in loop", () => {
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 500; i++) {
            const rgba = allocRgba();
            writeRgbaChannels(rgba, { red: Math.random(), green: Math.random(), blue: Math.random(), alpha: 1.0 });
        }

        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - boxed types - memory leaks fonts", () => {
    it("does not leak font descriptions", () => {
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 200; i++) {
            const fontDesc = call(
                PANGO_LIB,
                "pango_font_description_from_string",
                [{ type: STRING, value: `Sans ${10 + (i % 20)}` }],
                PANGO_FONT_DESC,
            );

            call(
                PANGO_LIB,
                "pango_font_description_to_string",
                [{ type: PANGO_FONT_DESC_NONE, value: fontDesc }],
                STRING,
            );
        }

        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - boxed types - memory leaks rectangles", () => {
    it("does not leak rectangles in loop", () => {
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 500; i++) {
            const rect = allocRectangle();
            writeRectangleFields(rect, { x: i, y: i, width: 100, height: 100 });
        }

        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - boxed types - edge cases multi-lib", () => {
    it("handles boxed types from different libraries", () => {
        const rgba = allocRgba();
        const fontDesc = call(
            PANGO_LIB,
            "pango_font_description_from_string",
            [{ type: STRING, value: "Sans 12" }],
            PANGO_FONT_DESC,
        );

        expect(rgba).toBeDefined();
        expect(fontDesc).toBeDefined();

        call(
            GDK_LIB,
            "gdk_rgba_parse",
            [
                { type: RGBA_BOXED_NONE, value: rgba },
                { type: STRING, value: "red" },
            ],
            BOOLEAN,
        );

        const family = call(
            PANGO_LIB,
            "pango_font_description_get_family",
            [{ type: PANGO_FONT_DESC_NONE, value: fontDesc }],
            STRING_BORROWED,
        );

        expect(family).toBe("Sans");
    });
});

describe("call - boxed types - edge cases zero-init", () => {
    it("handles zero-initialized boxed", () => {
        const rgba = allocRgba();

        const channels = readRgbaChannels(rgba);

        expect(channels.red).toBe(0);
        expect(channels.green).toBe(0);
        expect(channels.blue).toBe(0);
        expect(channels.alpha).toBe(0);
    });
});
