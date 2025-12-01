import { describe, expect, it } from "vitest";
import { alloc, call, read, write } from "../index.js";
import { GDK_LIB, GOBJECT_LIB, GTK_LIB, setup } from "./integration.js";

setup();

describe("GObject Types", () => {
    it("should handle borrowed GObject (refcount not transferred)", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
            type: "gobject",
            borrowed: true,
        });
        expect(label).not.toBeNull();

        const text = call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: label }], {
            type: "string",
            borrowed: true,
        });
        expect(text).toBe("Test");
    });

    it("should handle owned GObject (refcount transferred)", () => {
        const box = call(
            GTK_LIB,
            "gtk_box_new",
            [
                { type: { type: "int", size: 32 }, value: 0 },
                { type: { type: "int", size: 32 }, value: 0 },
            ],
            { type: "gobject", borrowed: true },
        );
        expect(box).not.toBeNull();

        call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
            type: "gobject",
            borrowed: true,
        });
    });

    it("should handle null GObject argument", () => {
        const listView = call(
            GTK_LIB,
            "gtk_list_view_new",
            [
                { type: { type: "null" }, value: null },
                { type: { type: "null" }, value: null },
            ],
            { type: "gobject", borrowed: true },
        );
        expect(listView).not.toBeNull();
    });

    it("should allow setting and getting properties", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Initial" }], {
            type: "gobject",
            borrowed: true,
        });

        call(
            GTK_LIB,
            "gtk_label_set_label",
            [
                { type: { type: "gobject" }, value: label },
                { type: { type: "string" }, value: "Modified" },
            ],
            { type: "undefined" },
        );

        const text = call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: label }], {
            type: "string",
            borrowed: true,
        });
        expect(text).toBe("Modified");
    });

    it("should handle object hierarchy", () => {
        const button = call(GTK_LIB, "gtk_button_new_with_label", [{ type: { type: "string" }, value: "Click" }], {
            type: "gobject",
            borrowed: true,
        });

        const isWidget = call(GTK_LIB, "gtk_widget_get_visible", [{ type: { type: "gobject" }, value: button }], {
            type: "boolean",
        });
        expect(typeof isWidget).toBe("boolean");
    });

    it("should increase refcount when adding widget to container", () => {
        const box = call(
            GTK_LIB,
            "gtk_box_new",
            [
                { type: { type: "int", size: 32 }, value: 0 },
                { type: { type: "int", size: 32 }, value: 0 },
            ],
            { type: "gobject", borrowed: true },
        );

        call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
            type: "gobject",
            borrowed: true,
        });

        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Child" }], {
            type: "gobject",
            borrowed: true,
        });

        const labelRefBeforeAdd = read(label, { type: "int", size: 32, unsigned: true }, 8) as number;

        call(
            GTK_LIB,
            "gtk_box_append",
            [
                { type: { type: "gobject" }, value: box },
                { type: { type: "gobject" }, value: label },
            ],
            { type: "undefined" },
        );

        const labelRefAfterAdd = read(label, { type: "int", size: 32, unsigned: true }, 8) as number;
        expect(labelRefAfterAdd).toBe(labelRefBeforeAdd + 1);
    });
});

describe("Boxed Types", () => {
    it("should allocate and read/write GdkRGBA", () => {
        const rgba = alloc(16, "GdkRGBA", GDK_LIB);
        expect(rgba).not.toBeNull();

        write(rgba, { type: "float", size: 32 }, 0, 1.0);
        write(rgba, { type: "float", size: 32 }, 4, 0.5);
        write(rgba, { type: "float", size: 32 }, 8, 0.25);
        write(rgba, { type: "float", size: 32 }, 12, 1.0);

        expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(1.0, 5);
        expect(read(rgba, { type: "float", size: 32 }, 4)).toBeCloseTo(0.5, 5);
        expect(read(rgba, { type: "float", size: 32 }, 8)).toBeCloseTo(0.25, 5);
        expect(read(rgba, { type: "float", size: 32 }, 12)).toBeCloseTo(1.0, 5);
    });

    it("should pass boxed types to functions", () => {
        const rgba = alloc(16, "GdkRGBA", GDK_LIB);
        write(rgba, { type: "float", size: 32 }, 0, 1.0);
        write(rgba, { type: "float", size: 32 }, 4, 0.0);
        write(rgba, { type: "float", size: 32 }, 8, 0.0);
        write(rgba, { type: "float", size: 32 }, 12, 1.0);

        const result = call(
            GDK_LIB,
            "gdk_rgba_to_string",
            [{ type: { type: "boxed", innerType: "GdkRGBA", lib: GDK_LIB }, value: rgba }],
            { type: "string" },
        );
        expect(result).toContain("rgb");
    });

    it("should handle boxed type equality", () => {
        const rgba1 = alloc(16, "GdkRGBA", GDK_LIB);
        write(rgba1, { type: "float", size: 32 }, 0, 1.0);
        write(rgba1, { type: "float", size: 32 }, 4, 0.5);
        write(rgba1, { type: "float", size: 32 }, 8, 0.25);
        write(rgba1, { type: "float", size: 32 }, 12, 1.0);

        const rgba2 = alloc(16, "GdkRGBA", GDK_LIB);
        write(rgba2, { type: "float", size: 32 }, 0, 1.0);
        write(rgba2, { type: "float", size: 32 }, 4, 0.5);
        write(rgba2, { type: "float", size: 32 }, 8, 0.25);
        write(rgba2, { type: "float", size: 32 }, 12, 1.0);

        const equal = call(
            GDK_LIB,
            "gdk_rgba_equal",
            [
                { type: { type: "boxed", innerType: "GdkRGBA", lib: GDK_LIB }, value: rgba1 },
                { type: { type: "boxed", innerType: "GdkRGBA", lib: GDK_LIB }, value: rgba2 },
            ],
            { type: "boolean" },
        );
        expect(equal).toBe(true);
    });

    it("should parse RGBA from string", () => {
        const rgba = alloc(16, "GdkRGBA", GDK_LIB);

        const success = call(
            GDK_LIB,
            "gdk_rgba_parse",
            [
                { type: { type: "boxed", innerType: "GdkRGBA", lib: GDK_LIB }, value: rgba },
                { type: { type: "string" }, value: "rgba(255, 128, 64, 0.5)" },
            ],
            { type: "boolean" },
        );
        expect(success).toBe(true);

        expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(1.0, 1);
        expect(read(rgba, { type: "float", size: 32 }, 12)).toBeCloseTo(0.5, 1);
    });
});
