import { describe, expect, it } from "vitest";
import { alloc, call, read, write } from "../index.js";
import { GLIB_LIB, GTK_LIB, setup } from "./integration.js";

setup();

describe("Integer Types", () => {
    it("should handle 8-bit signed integers", () => {
        const result = call(GLIB_LIB, "g_ascii_digit_value", [{ type: { type: "int", size: 8 }, value: 53 }], {
            type: "int",
            size: 32,
        });
        expect(result).toBe(5);
    });

    it("should handle 32-bit signed integers", () => {
        const result = call(
            GLIB_LIB,
            "g_random_int_range",
            [
                { type: { type: "int", size: 32 }, value: 10 },
                { type: { type: "int", size: 32 }, value: 11 },
            ],
            { type: "int", size: 32 },
        );
        expect(result).toBe(10);
    });

    it("should handle 32-bit unsigned integers", () => {
        const quark = call(GLIB_LIB, "g_quark_from_string", [{ type: { type: "string" }, value: "test-quark" }], {
            type: "int",
            size: 32,
            unsigned: true,
        }) as number;
        expect(quark).toBeGreaterThan(0);

        const retrieved = call(
            GLIB_LIB,
            "g_quark_to_string",
            [{ type: { type: "int", size: 32, unsigned: true }, value: quark }],
            { type: "string", borrowed: true },
        );
        expect(retrieved).toBe("test-quark");
    });

    it("should handle zero", () => {
        const result = call(
            GLIB_LIB,
            "g_random_int_range",
            [
                { type: { type: "int", size: 32 }, value: 0 },
                { type: { type: "int", size: 32 }, value: 1 },
            ],
            { type: "int", size: 32 },
        );
        expect(result).toBe(0);
    });

    it("should handle boundary values for 32-bit signed", () => {
        const max = call(
            GLIB_LIB,
            "g_random_int_range",
            [
                { type: { type: "int", size: 32 }, value: 2147483646 },
                { type: { type: "int", size: 32 }, value: 2147483647 },
            ],
            { type: "int", size: 32 },
        );
        expect(max).toBe(2147483646);
    });

    it("should handle 64-bit unsigned integers (GType)", () => {
        const gtype = call(GTK_LIB, "gtk_widget_get_type", [], { type: "int", size: 64, unsigned: true });
        expect(gtype).toBeGreaterThan(0);
    });

    it("should handle 64-bit signed integers", () => {
        const time = call(GLIB_LIB, "g_get_monotonic_time", [], { type: "int", size: 64, unsigned: false });
        expect(time).toBeGreaterThan(0);
    });
});

describe("Float Types", () => {
    it("should handle 32-bit floats", () => {
        const ptr = alloc(16, "GdkRGBA", GTK_LIB);
        write(ptr, { type: "float", size: 32 }, 0, 0.5);
        const result = read(ptr, { type: "float", size: 32 }, 0);
        expect(result).toBeCloseTo(0.5, 5);
    });

    it("should handle 64-bit floats (doubles)", () => {
        const result = call(
            GLIB_LIB,
            "g_ascii_strtod",
            [
                { type: { type: "string" }, value: "3.14159265358979" },
                { type: { type: "null" }, value: null },
            ],
            { type: "float", size: 64 },
        );
        expect(result).toBeCloseTo(Math.PI, 10);
    });

    it("should handle float zero", () => {
        const ptr = alloc(16, "GdkRGBA", GTK_LIB);
        write(ptr, { type: "float", size: 32 }, 0, 0.0);
        const result = read(ptr, { type: "float", size: 32 }, 0);
        expect(result).toBe(0.0);
    });

    it("should handle negative floats", () => {
        const result = call(
            GLIB_LIB,
            "g_ascii_strtod",
            [
                { type: { type: "string" }, value: "-2.5" },
                { type: { type: "null" }, value: null },
            ],
            { type: "float", size: 64 },
        );
        expect(result).toBeCloseTo(-2.5, 5);
    });

    it("should handle very small floats", () => {
        const result = call(
            GLIB_LIB,
            "g_ascii_strtod",
            [
                { type: { type: "string" }, value: "0.000001" },
                { type: { type: "null" }, value: null },
            ],
            { type: "float", size: 64 },
        );
        expect(result).toBeCloseTo(0.000001, 10);
    });

    it("should handle very large floats", () => {
        const result = call(
            GLIB_LIB,
            "g_ascii_strtod",
            [
                { type: { type: "string" }, value: "1e10" },
                { type: { type: "null" }, value: null },
            ],
            { type: "float", size: 64 },
        );
        expect(result).toBeCloseTo(1e10, 0);
    });
});

describe("Boolean Type", () => {
    it("should pass boolean true as argument and return", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
            type: "gobject",
            borrowed: true,
        });

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: { type: "gobject" }, value: label },
                { type: { type: "boolean" }, value: true },
            ],
            { type: "undefined" },
        );

        const isSelectable = call(GTK_LIB, "gtk_label_get_selectable", [{ type: { type: "gobject" }, value: label }], {
            type: "boolean",
        });
        expect(isSelectable).toBe(true);
    });

    it("should handle false boolean", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
            type: "gobject",
            borrowed: true,
        });

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: { type: "gobject" }, value: label },
                { type: { type: "boolean" }, value: false },
            ],
            { type: "undefined" },
        );

        const isSelectable = call(GTK_LIB, "gtk_label_get_selectable", [{ type: { type: "gobject" }, value: label }], {
            type: "boolean",
        });
        expect(isSelectable).toBe(false);
    });
});

describe("Null and Undefined Types", () => {
    it("should handle null argument", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "null" }, value: null }], {
            type: "gobject",
            borrowed: true,
        });
        expect(label).not.toBeNull();
    });

    it("should handle undefined return (void functions)", () => {
        const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

        const result = call(
            GTK_LIB,
            "gtk_button_set_label",
            [
                { type: { type: "gobject" }, value: button },
                { type: { type: "string" }, value: "test" },
            ],
            { type: "undefined" },
        );
        expect(result).toBeUndefined();
    });

    it("should handle null in optional object parameters", () => {
        const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });

        call(
            GTK_LIB,
            "gtk_window_set_child",
            [
                { type: { type: "gobject" }, value: window },
                { type: { type: "null" }, value: null },
            ],
            { type: "undefined" },
        );
    });
});
