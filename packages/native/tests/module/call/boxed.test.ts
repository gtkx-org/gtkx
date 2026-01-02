import { describe, expect, it } from "vitest";
import { alloc, call, read, write } from "../../../index.js";
import {
    BOOLEAN,
    FLOAT32,
    GDK_LIB,
    INT32,
    PANGO_LIB,
    STRING,
    STRING_NONE,
    startMemoryMeasurement,
    UNDEFINED,
} from "../utils.js";

const RGBA_BOXED_NONE = { type: "boxed" as const, innerType: "GdkRGBA", lib: GDK_LIB, ownership: "none" as const };
const RECTANGLE_BOXED_NONE = {
    type: "boxed" as const,
    innerType: "GdkRectangle",
    lib: GDK_LIB,
    ownership: "none" as const,
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
    ownership: "none" as const,
};

describe("call - boxed types", () => {
    describe("GdkRGBA", () => {
        it("creates RGBA boxed type via alloc", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

            expect(rgba).toBeDefined();

            write(rgba, FLOAT32, 0, 1.0);
            write(rgba, FLOAT32, 4, 0.0);
            write(rgba, FLOAT32, 8, 0.0);
            write(rgba, FLOAT32, 12, 1.0);

            const red = read(rgba, FLOAT32, 0);
            const green = read(rgba, FLOAT32, 4);
            const blue = read(rgba, FLOAT32, 8);
            const alpha = read(rgba, FLOAT32, 12);

            expect(red).toBeCloseTo(1.0);
            expect(green).toBeCloseTo(0.0);
            expect(blue).toBeCloseTo(0.0);
            expect(alpha).toBeCloseTo(1.0);
        });

        it("parses RGBA from string", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

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

            const red = read(rgba, FLOAT32, 0);
            const green = read(rgba, FLOAT32, 4);
            const blue = read(rgba, FLOAT32, 8);

            expect(red).toBeCloseTo(1.0);
            expect(green).toBeCloseTo(0.5, 1);
            expect(blue).toBeCloseTo(0.0);
        });

        it("converts RGBA to string", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

            write(rgba, FLOAT32, 0, 1.0);
            write(rgba, FLOAT32, 4, 0.5);
            write(rgba, FLOAT32, 8, 0.0);
            write(rgba, FLOAT32, 12, 1.0);

            const result = call(GDK_LIB, "gdk_rgba_to_string", [{ type: RGBA_BOXED_NONE, value: rgba }], STRING);

            expect(typeof result).toBe("string");
            expect(result).toContain("rgb");
        });

        it("compares two RGBA values", () => {
            const rgba1 = alloc(16, "GdkRGBA", GDK_LIB);
            const rgba2 = alloc(16, "GdkRGBA", GDK_LIB);

            write(rgba1, FLOAT32, 0, 1.0);
            write(rgba1, FLOAT32, 4, 0.0);
            write(rgba1, FLOAT32, 8, 0.0);
            write(rgba1, FLOAT32, 12, 1.0);

            write(rgba2, FLOAT32, 0, 1.0);
            write(rgba2, FLOAT32, 4, 0.0);
            write(rgba2, FLOAT32, 8, 0.0);
            write(rgba2, FLOAT32, 12, 1.0);

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

    describe("GdkRectangle", () => {
        it("creates rectangle boxed type", () => {
            const rect = alloc(16, "GdkRectangle", GDK_LIB);

            write(rect, INT32, 0, 10);
            write(rect, INT32, 4, 20);
            write(rect, INT32, 8, 100);
            write(rect, INT32, 12, 50);

            const x = read(rect, INT32, 0);
            const y = read(rect, INT32, 4);
            const width = read(rect, INT32, 8);
            const height = read(rect, INT32, 12);

            expect(x).toBe(10);
            expect(y).toBe(20);
            expect(width).toBe(100);
            expect(height).toBe(50);
        });

        it("checks rectangle intersection", () => {
            const rect1 = alloc(16, "GdkRectangle", GDK_LIB);
            const rect2 = alloc(16, "GdkRectangle", GDK_LIB);
            const dest = alloc(16, "GdkRectangle", GDK_LIB);

            write(rect1, INT32, 0, 0);
            write(rect1, INT32, 4, 0);
            write(rect1, INT32, 8, 100);
            write(rect1, INT32, 12, 100);

            write(rect2, INT32, 0, 50);
            write(rect2, INT32, 4, 50);
            write(rect2, INT32, 8, 100);
            write(rect2, INT32, 12, 100);

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

            const destX = read(dest, INT32, 0);
            const destY = read(dest, INT32, 4);
            const destWidth = read(dest, INT32, 8);
            const destHeight = read(dest, INT32, 12);

            expect(destX).toBe(50);
            expect(destY).toBe(50);
            expect(destWidth).toBe(50);
            expect(destHeight).toBe(50);
        });

        it("computes rectangle union", () => {
            const rect1 = alloc(16, "GdkRectangle", GDK_LIB);
            const rect2 = alloc(16, "GdkRectangle", GDK_LIB);
            const dest = alloc(16, "GdkRectangle", GDK_LIB);

            write(rect1, INT32, 0, 0);
            write(rect1, INT32, 4, 0);
            write(rect1, INT32, 8, 50);
            write(rect1, INT32, 12, 50);

            write(rect2, INT32, 0, 50);
            write(rect2, INT32, 4, 50);
            write(rect2, INT32, 8, 50);
            write(rect2, INT32, 12, 50);

            call(
                GDK_LIB,
                "gdk_rectangle_union",
                [
                    { type: RECTANGLE_BOXED_NONE, value: rect1 },
                    { type: RECTANGLE_BOXED_NONE, value: rect2 },
                    { type: RECTANGLE_BOXED_NONE, value: dest },
                ],
                UNDEFINED,
            );

            const destWidth = read(dest, INT32, 8);
            const destHeight = read(dest, INT32, 12);

            expect(destWidth).toBe(100);
            expect(destHeight).toBe(100);
        });

        it("checks if point is contained in rectangle", () => {
            const rect = alloc(16, "GdkRectangle", GDK_LIB);

            write(rect, INT32, 0, 0);
            write(rect, INT32, 4, 0);
            write(rect, INT32, 8, 100);
            write(rect, INT32, 12, 100);

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

    describe("PangoFontDescription", () => {
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
                STRING_NONE,
            );

            expect(family).toBe("Sans");
        });

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
                UNDEFINED,
            );

            const size = call(
                PANGO_LIB,
                "pango_font_description_get_size",
                [{ type: PANGO_FONT_DESC_NONE, value: fontDesc }],
                INT32,
            );

            expect(size).toBe(14 * 1024);
        });

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

    describe("ownership", () => {
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
                STRING_NONE,
            );

            expect(family).toBe("Monospace");
        });

        it("handles transfer none boxed correctly", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

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

    describe("memory leaks", () => {
        it("does not leak when creating many boxed in loop", () => {
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 500; i++) {
                const rgba = alloc(16, "GdkRGBA", GDK_LIB);
                write(rgba, FLOAT32, 0, Math.random());
                write(rgba, FLOAT32, 4, Math.random());
                write(rgba, FLOAT32, 8, Math.random());
                write(rgba, FLOAT32, 12, 1.0);
            }

            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
        });

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

        it("does not leak rectangles in loop", () => {
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 500; i++) {
                const rect = alloc(16, "GdkRectangle", GDK_LIB);
                write(rect, INT32, 0, i);
                write(rect, INT32, 4, i);
                write(rect, INT32, 8, 100);
                write(rect, INT32, 12, 100);
            }

            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
        });
    });

    describe("edge cases", () => {
        it("handles boxed types from different libraries", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);
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
                STRING_NONE,
            );

            expect(family).toBe("Sans");
        });

        it("handles zero-initialized boxed", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);

            const red = read(rgba, FLOAT32, 0);
            const green = read(rgba, FLOAT32, 4);
            const blue = read(rgba, FLOAT32, 8);
            const alpha = read(rgba, FLOAT32, 12);

            expect(red).toBe(0);
            expect(green).toBe(0);
            expect(blue).toBe(0);
            expect(alpha).toBe(0);
        });
    });
});
