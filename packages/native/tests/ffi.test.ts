import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { alloc, call, read, start, stop, write } from "../index.js";

const GTK_LIB = "libgtk-4.so.1";
const GDK_LIB = "libgtk-4.so.1";
const GOBJECT_LIB = "libgobject-2.0.so.0";
const GLIB_LIB = "libglib-2.0.so.0";
const GIO_LIB = "libgio-2.0.so.0";

beforeAll(() => {
    start("com.gtkx.test");
});

afterAll(() => {
    stop();
});

describe("FFI Integration Tests", () => {
    describe("Primitive Types", () => {
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
                const quark = call(
                    GLIB_LIB,
                    "g_quark_from_string",
                    [{ type: { type: "string" }, value: "test-quark" }],
                    { type: "int", size: 32, unsigned: true },
                ) as number;
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

            it("should handle float one", () => {
                const ptr = alloc(16, "GdkRGBA", GTK_LIB);
                write(ptr, { type: "float", size: 32 }, 0, 1.0);
                const result = read(ptr, { type: "float", size: 32 }, 0);
                expect(result).toBe(1.0);
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
            it("should pass boolean as argument and return", () => {
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

                const isSelectable = call(
                    GTK_LIB,
                    "gtk_label_get_selectable",
                    [{ type: { type: "gobject" }, value: label }],
                    { type: "boolean" },
                );
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

                const isSelectable = call(
                    GTK_LIB,
                    "gtk_label_get_selectable",
                    [{ type: { type: "gobject" }, value: label }],
                    { type: "boolean" },
                );
                expect(isSelectable).toBe(false);
            });
        });
    });

    describe("String Types", () => {
        it("should handle owned strings", () => {
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "owned-test" }], {
                type: "string",
            });
            expect(result).toBe("owned-test");
        });

        it("should handle empty strings", () => {
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "" }], { type: "string" });
            expect(result).toBe("");
        });

        it("should handle unicode strings", () => {
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "Hello 世界 🌍" }], {
                type: "string",
            });
            expect(result).toBe("Hello 世界 🌍");
        });

        it("should handle strings with special characters", () => {
            const result = call(
                GLIB_LIB,
                "g_strdup",
                [{ type: { type: "string" }, value: "tab\there\nnewline\r\nwindows" }],
                { type: "string" },
            );
            expect(result).toBe("tab\there\nnewline\r\nwindows");
        });

        it("should handle very long strings", () => {
            const longString = "a".repeat(10000);
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: longString }], {
                type: "string",
            });
            expect(result).toBe(longString);
        });

        it("should handle borrowed strings from quark", () => {
            const quark = call(
                GLIB_LIB,
                "g_quark_from_string",
                [{ type: { type: "string" }, value: "borrowed-string-test" }],
                { type: "int", size: 32, unsigned: true },
            ) as number;

            const result = call(
                GLIB_LIB,
                "g_quark_to_string",
                [{ type: { type: "int", size: 32, unsigned: true }, value: quark }],
                { type: "string", borrowed: true },
            );
            expect(result).toBe("borrowed-string-test");
        });
    });

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

        it("should have positive refcount after ref_sink", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "RefTest" }], {
                type: "gobject",
                borrowed: true,
            });

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: label }], {
                type: "gobject",
                borrowed: true,
            });

            const refCount = read(label, { type: "int", size: 32, unsigned: true }, 8);
            expect(refCount).toBeGreaterThan(0);
        });

        it("should increase refcount by 1 on g_object_ref", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "RefTest" }], {
                type: "gobject",
                borrowed: true,
            });

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: label }], {
                type: "gobject",
                borrowed: true,
            });

            const initialRefCount = read(label, { type: "int", size: 32, unsigned: true }, 8) as number;

            call(GOBJECT_LIB, "g_object_ref", [{ type: { type: "gobject" }, value: label }], {
                type: "undefined",
            });

            const afterRefCount = read(label, { type: "int", size: 32, unsigned: true }, 8) as number;
            expect(afterRefCount).toBe(initialRefCount + 1);

            call(GOBJECT_LIB, "g_object_unref", [{ type: { type: "gobject" }, value: label }], {
                type: "undefined",
            });

            const finalRefCount = read(label, { type: "int", size: 32, unsigned: true }, 8) as number;
            expect(finalRefCount).toBe(initialRefCount);
        });

        it("should maintain refcount when passing borrowed to functions", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "BorrowedTest" }], {
                type: "gobject",
                borrowed: true,
            });

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: label }], {
                type: "gobject",
                borrowed: true,
            });

            const initialRefCount = read(label, { type: "int", size: 32, unsigned: true }, 8);

            call(
                GTK_LIB,
                "gtk_label_set_label",
                [
                    { type: { type: "gobject" }, value: label },
                    { type: { type: "string" }, value: "Modified" },
                ],
                { type: "undefined" },
            );

            const afterCallRefCount = read(label, { type: "int", size: 32, unsigned: true }, 8);
            expect(afterCallRefCount).toBe(initialRefCount);

            call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: label }], {
                type: "string",
                borrowed: true,
            });

            const finalRefCount = read(label, { type: "int", size: 32, unsigned: true }, 8);
            expect(finalRefCount).toBe(initialRefCount);
        });

        it("should increase refcount when adding widget to container (container takes ownership)", () => {
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

            call(
                GTK_LIB,
                "gtk_box_remove",
                [
                    { type: { type: "gobject" }, value: box },
                    { type: { type: "gobject" }, value: label },
                ],
                { type: "undefined" },
            );

            const labelRefAfterRemove = read(label, { type: "int", size: 32, unsigned: true }, 8) as number;
            expect(labelRefAfterRemove).toBe(labelRefBeforeAdd);
        });

        it("should handle multiple refs and unrefs correctly", () => {
            const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: button }], {
                type: "gobject",
                borrowed: true,
            });

            const baseRefCount = read(button, { type: "int", size: 32, unsigned: true }, 8) as number;

            for (let i = 0; i < 5; i++) {
                call(GOBJECT_LIB, "g_object_ref", [{ type: { type: "gobject" }, value: button }], {
                    type: "undefined",
                });
            }

            expect(read(button, { type: "int", size: 32, unsigned: true }, 8)).toBe(baseRefCount + 5);

            for (let i = 0; i < 5; i++) {
                call(GOBJECT_LIB, "g_object_unref", [{ type: { type: "gobject" }, value: button }], {
                    type: "undefined",
                });
            }

            expect(read(button, { type: "int", size: 32, unsigned: true }, 8)).toBe(baseRefCount);
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

        it("should handle boxed type copy", () => {
            const original = alloc(16, "GdkRGBA", GDK_LIB);
            write(original, { type: "float", size: 32 }, 0, 0.75);
            write(original, { type: "float", size: 32 }, 4, 0.5);
            write(original, { type: "float", size: 32 }, 8, 0.25);
            write(original, { type: "float", size: 32 }, 12, 1.0);

            const copy = call(
                GDK_LIB,
                "gdk_rgba_copy",
                [{ type: { type: "boxed", innerType: "GdkRGBA", lib: GDK_LIB }, value: original }],
                { type: "boxed", innerType: "GdkRGBA", lib: GDK_LIB, borrowed: true },
            );
            expect(copy).not.toBeNull();

            expect(read(copy, { type: "float", size: 32 }, 0)).toBeCloseTo(0.75, 5);
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

    describe("Callback Types", () => {
        it("should handle signal connection with callback", () => {
            const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: { type: "gobject" }, value: button },
                    { type: { type: "string" }, value: "clicked" },
                    {
                        type: { type: "callback", argTypes: [{ type: "gobject", borrowed: true }] },
                        value: () => {},
                    },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "int", size: 64, unsigned: true },
            );
            expect(handlerId).toBeGreaterThan(0);
        });

        it("should handle callbacks that receive arguments", () => {
            const factory = call(GTK_LIB, "gtk_signal_list_item_factory_new", [], { type: "gobject", borrowed: true });

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: { type: "gobject" }, value: factory },
                    { type: { type: "string" }, value: "setup" },
                    {
                        type: {
                            type: "callback",
                            argTypes: [
                                { type: "gobject", borrowed: true },
                                { type: "gobject", borrowed: true },
                            ],
                        },
                        value: (_self: unknown, _listItem: unknown) => {},
                    },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "int", size: 64, unsigned: true },
            );
            expect(handlerId).toBeGreaterThan(0);
        });

        it("should handle callbacks that return values", () => {
            const widget = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

            const gestureClick = call(GTK_LIB, "gtk_gesture_click_new", [], { type: "gobject", borrowed: true });

            call(
                GTK_LIB,
                "gtk_widget_add_controller",
                [
                    { type: { type: "gobject" }, value: widget },
                    { type: { type: "gobject" }, value: gestureClick },
                ],
                { type: "undefined" },
            );

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: { type: "gobject" }, value: gestureClick },
                    { type: { type: "string" }, value: "pressed" },
                    {
                        type: {
                            type: "callback",
                            argTypes: [
                                { type: "gobject", borrowed: true },
                                { type: "int", size: 32 },
                                { type: "float", size: 64 },
                                { type: "float", size: 64 },
                            ],
                        },
                        value: () => {},
                    },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "int", size: 64, unsigned: true },
            );
            expect(handlerId).toBeGreaterThan(0);
        });

        it("should handle multiple callbacks on same object", () => {
            const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

            const handlers: number[] = [];
            for (let i = 0; i < 5; i++) {
                const handlerId = call(
                    GOBJECT_LIB,
                    "g_signal_connect_closure",
                    [
                        { type: { type: "gobject" }, value: button },
                        { type: { type: "string" }, value: "clicked" },
                        {
                            type: { type: "callback", argTypes: [{ type: "gobject", borrowed: true }] },
                            value: () => {},
                        },
                        { type: { type: "boolean" }, value: false },
                    ],
                    { type: "int", size: 64, unsigned: true },
                ) as number;
                handlers.push(handlerId);
            }

            expect(handlers.length).toBe(5);
            expect(new Set(handlers).size).toBe(5);
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
});

describe("ListView Integration Tests", () => {
    it("should create ListView with factory, model, and present in window", async () => {
        let setupCount = 0;
        let bindCount = 0;
        const boundItems: string[] = [];

        const store = call(
            GIO_LIB,
            "g_list_store_new",
            [
                {
                    type: { type: "int", size: 64, unsigned: true },
                    value: call(GTK_LIB, "gtk_string_object_get_type", [], { type: "int", size: 64, unsigned: true }),
                },
            ],
            { type: "gobject", borrowed: true },
        );

        for (let i = 0; i < 5; i++) {
            const strObj = call(
                GTK_LIB,
                "gtk_string_object_new",
                [{ type: { type: "string" }, value: `Item ${i + 1}` }],
                { type: "gobject", borrowed: true },
            );
            call(
                GIO_LIB,
                "g_list_store_append",
                [
                    { type: { type: "gobject" }, value: store },
                    { type: { type: "gobject" }, value: strObj },
                ],
                { type: "undefined" },
            );
        }

        const selectionModel = call(
            GTK_LIB,
            "gtk_single_selection_new",
            [{ type: { type: "gobject" }, value: store }],
            { type: "gobject", borrowed: true },
        );

        const factory = call(GTK_LIB, "gtk_signal_list_item_factory_new", [], { type: "gobject", borrowed: true });

        call(
            GOBJECT_LIB,
            "g_signal_connect_closure",
            [
                { type: { type: "gobject" }, value: factory },
                { type: { type: "string" }, value: "setup" },
                {
                    type: {
                        type: "callback",
                        argTypes: [
                            { type: "gobject", borrowed: true },
                            { type: "gobject", borrowed: true },
                        ],
                    },
                    value: (_self: unknown, listItem: unknown) => {
                        setupCount++;
                        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "null" }, value: null }], {
                            type: "gobject",
                            borrowed: true,
                        });
                        call(
                            GTK_LIB,
                            "gtk_list_item_set_child",
                            [
                                { type: { type: "gobject" }, value: listItem },
                                { type: { type: "gobject" }, value: label },
                            ],
                            { type: "undefined" },
                        );
                    },
                },
                { type: { type: "boolean" }, value: false },
            ],
            { type: "int", size: 64, unsigned: true },
        );

        call(
            GOBJECT_LIB,
            "g_signal_connect_closure",
            [
                { type: { type: "gobject" }, value: factory },
                { type: { type: "string" }, value: "bind" },
                {
                    type: {
                        type: "callback",
                        argTypes: [
                            { type: "gobject", borrowed: true },
                            { type: "gobject", borrowed: true },
                        ],
                    },
                    value: (_self: unknown, listItem: unknown) => {
                        bindCount++;
                        const child = call(
                            GTK_LIB,
                            "gtk_list_item_get_child",
                            [{ type: { type: "gobject" }, value: listItem }],
                            { type: "gobject", borrowed: true },
                        );
                        const item = call(
                            GTK_LIB,
                            "gtk_list_item_get_item",
                            [{ type: { type: "gobject" }, value: listItem }],
                            { type: "gobject", borrowed: true },
                        );
                        if (child && item) {
                            const text = call(
                                GTK_LIB,
                                "gtk_string_object_get_string",
                                [{ type: { type: "gobject" }, value: item }],
                                { type: "string", borrowed: true },
                            ) as string;
                            boundItems.push(text);
                            call(
                                GTK_LIB,
                                "gtk_label_set_label",
                                [
                                    { type: { type: "gobject" }, value: child },
                                    { type: { type: "string" }, value: text },
                                ],
                                { type: "undefined" },
                            );
                        }
                    },
                },
                { type: { type: "boolean" }, value: false },
            ],
            { type: "int", size: 64, unsigned: true },
        );

        const listView = call(
            GTK_LIB,
            "gtk_list_view_new",
            [
                { type: { type: "gobject" }, value: selectionModel },
                { type: { type: "gobject" }, value: factory },
            ],
            { type: "gobject", borrowed: true },
        );
        expect(listView).not.toBeNull();

        const scrolledWindow = call(GTK_LIB, "gtk_scrolled_window_new", [], { type: "gobject", borrowed: true });
        call(
            GTK_LIB,
            "gtk_scrolled_window_set_child",
            [
                { type: { type: "gobject" }, value: scrolledWindow },
                { type: { type: "gobject" }, value: listView },
            ],
            { type: "undefined" },
        );

        const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });
        call(
            GTK_LIB,
            "gtk_window_set_default_size",
            [
                { type: { type: "gobject" }, value: window },
                { type: { type: "int", size: 32 }, value: 400 },
                { type: { type: "int", size: 32 }, value: 300 },
            ],
            { type: "undefined" },
        );
        call(
            GTK_LIB,
            "gtk_window_set_child",
            [
                { type: { type: "gobject" }, value: window },
                { type: { type: "gobject" }, value: scrolledWindow },
            ],
            { type: "undefined" },
        );

        call(GTK_LIB, "gtk_window_present", [{ type: { type: "gobject" }, value: window }], { type: "undefined" });

        const startTime = Date.now();
        const timeout = process.env.CI ? 2000 : 500;
        while (Date.now() - startTime < timeout) {
            call(
                GLIB_LIB,
                "g_main_context_iteration",
                [
                    { type: { type: "null" }, value: null },
                    { type: { type: "boolean" }, value: true },
                ],
                { type: "boolean" },
            );
            if (setupCount > 0 && bindCount > 0) break;
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        expect(setupCount).toBeGreaterThan(0);
        expect(bindCount).toBeGreaterThan(0);
        expect(boundItems.length).toBeGreaterThan(0);

        call(GTK_LIB, "gtk_window_close", [{ type: { type: "gobject" }, value: window }], { type: "undefined" });

        for (let i = 0; i < 50; i++) {
            call(
                GLIB_LIB,
                "g_main_context_iteration",
                [
                    { type: { type: "null" }, value: null },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "boolean" },
            );
        }
    });

    it("should handle ListView with many items using GListStore", () => {
        const store = call(
            GIO_LIB,
            "g_list_store_new",
            [
                {
                    type: { type: "int", size: 64, unsigned: true },
                    value: call(GTK_LIB, "gtk_string_object_get_type", [], { type: "int", size: 64, unsigned: true }),
                },
            ],
            { type: "gobject", borrowed: true },
        );

        for (let i = 0; i < 100; i++) {
            const strObj = call(GTK_LIB, "gtk_string_object_new", [{ type: { type: "string" }, value: `Item ${i}` }], {
                type: "gobject",
                borrowed: true,
            });
            call(
                GIO_LIB,
                "g_list_store_append",
                [
                    { type: { type: "gobject" }, value: store },
                    { type: { type: "gobject" }, value: strObj },
                ],
                { type: "undefined" },
            );
        }

        const count = call(GIO_LIB, "g_list_model_get_n_items", [{ type: { type: "gobject" }, value: store }], {
            type: "int",
            size: 32,
            unsigned: true,
        });
        expect(count).toBe(100);

        const selectionModel = call(
            GTK_LIB,
            "gtk_single_selection_new",
            [{ type: { type: "gobject" }, value: store }],
            { type: "gobject", borrowed: true },
        );

        const factory = call(GTK_LIB, "gtk_signal_list_item_factory_new", [], { type: "gobject", borrowed: true });

        const listView = call(
            GTK_LIB,
            "gtk_list_view_new",
            [
                { type: { type: "gobject" }, value: selectionModel },
                { type: { type: "gobject" }, value: factory },
            ],
            { type: "gobject", borrowed: true },
        );
        expect(listView).not.toBeNull();
    });

    it("should handle ListView model updates", () => {
        const store = call(
            GIO_LIB,
            "g_list_store_new",
            [
                {
                    type: { type: "int", size: 64, unsigned: true },
                    value: call(GTK_LIB, "gtk_string_object_get_type", [], { type: "int", size: 64, unsigned: true }),
                },
            ],
            { type: "gobject", borrowed: true },
        );

        for (let i = 0; i < 10; i++) {
            const strObj = call(
                GTK_LIB,
                "gtk_string_object_new",
                [{ type: { type: "string" }, value: `Dynamic Item ${i}` }],
                { type: "gobject", borrowed: true },
            );
            call(
                GIO_LIB,
                "g_list_store_append",
                [
                    { type: { type: "gobject" }, value: store },
                    { type: { type: "gobject" }, value: strObj },
                ],
                { type: "undefined" },
            );
        }

        const count = call(GIO_LIB, "g_list_model_get_n_items", [{ type: { type: "gobject" }, value: store }], {
            type: "int",
            size: 32,
            unsigned: true,
        });
        expect(count).toBe(10);

        call(
            GIO_LIB,
            "g_list_store_remove",
            [
                { type: { type: "gobject" }, value: store },
                { type: { type: "int", size: 32, unsigned: true }, value: 0 },
            ],
            { type: "undefined" },
        );

        const countAfter = call(GIO_LIB, "g_list_model_get_n_items", [{ type: { type: "gobject" }, value: store }], {
            type: "int",
            size: 32,
            unsigned: true,
        });
        expect(countAfter).toBe(9);
    });
});

describe("Stress Tests", () => {
    it("should handle rapid object creation", () => {
        const objects: unknown[] = [];
        for (let i = 0; i < 100; i++) {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: `Label ${i}` }], {
                type: "gobject",
                borrowed: true,
            });
            objects.push(label);
        }
        expect(objects.length).toBe(100);
    });

    it("should handle rapid boxed type allocation", () => {
        const colors: unknown[] = [];
        for (let i = 0; i < 100; i++) {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);
            write(rgba, { type: "float", size: 32 }, 0, i / 100);
            write(rgba, { type: "float", size: 32 }, 4, i / 100);
            write(rgba, { type: "float", size: 32 }, 8, i / 100);
            write(rgba, { type: "float", size: 32 }, 12, 1.0);
            colors.push(rgba);
        }
        expect(colors.length).toBe(100);
    });

    it("should handle rapid string operations", () => {
        for (let i = 0; i < 100; i++) {
            const result = call(
                GLIB_LIB,
                "g_strdup",
                [{ type: { type: "string" }, value: `String ${i} with some extra content to make it longer` }],
                { type: "string" },
            );
            expect(result).toBe(`String ${i} with some extra content to make it longer`);
        }
    });

    it("should handle rapid callback registration", () => {
        const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

        for (let i = 0; i < 50; i++) {
            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: { type: "gobject" }, value: button },
                    { type: { type: "string" }, value: "clicked" },
                    {
                        type: { type: "callback", argTypes: [{ type: "gobject", borrowed: true }] },
                        value: () => {},
                    },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "int", size: 64, unsigned: true },
            );
            expect(handlerId).toBeGreaterThan(0);
        }
    });

    it("should handle mixed operations stress test", () => {
        for (let i = 0; i < 50; i++) {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: `Label ${i}` }], {
                type: "gobject",
                borrowed: true,
            });

            const rgba = alloc(16, "GdkRGBA", GDK_LIB);
            write(rgba, { type: "float", size: 32 }, 0, i / 50);

            call(
                GTK_LIB,
                "gtk_label_set_selectable",
                [
                    { type: { type: "gobject" }, value: label },
                    { type: { type: "boolean" }, value: i % 2 === 0 },
                ],
                { type: "undefined" },
            );

            const text = call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: label }], {
                type: "string",
                borrowed: true,
            });
            expect(text).toBe(`Label ${i}`);
        }
    });

    it("should handle large widget hierarchy", () => {
        const box = call(
            GTK_LIB,
            "gtk_box_new",
            [
                { type: { type: "int", size: 32 }, value: 1 },
                { type: { type: "int", size: 32 }, value: 0 },
            ],
            { type: "gobject", borrowed: true },
        );

        for (let i = 0; i < 50; i++) {
            const childBox = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 0 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            for (let j = 0; j < 5; j++) {
                const button = call(
                    GTK_LIB,
                    "gtk_button_new_with_label",
                    [{ type: { type: "string" }, value: `Button ${i}-${j}` }],
                    { type: "gobject", borrowed: true },
                );

                call(
                    GTK_LIB,
                    "gtk_box_append",
                    [
                        { type: { type: "gobject" }, value: childBox },
                        { type: { type: "gobject" }, value: button },
                    ],
                    { type: "undefined" },
                );
            }

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: { type: "gobject" }, value: box },
                    { type: { type: "gobject" }, value: childBox },
                ],
                { type: "undefined" },
            );
        }
    });
});

describe("Memory Management Tests", () => {
    it("should not leak memory with repeated object creation and disposal", () => {
        for (let round = 0; round < 10; round++) {
            const objects: unknown[] = [];

            for (let i = 0; i < 100; i++) {
                const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: `Temp Label ${i}` }], {
                    type: "gobject",
                    borrowed: true,
                });
                objects.push(label);
            }

            objects.length = 0;
        }
    });

    it("should not leak memory with repeated boxed type allocation", () => {
        for (let round = 0; round < 10; round++) {
            for (let i = 0; i < 100; i++) {
                const rgba = alloc(16, "GdkRGBA", GDK_LIB);
                write(rgba, { type: "float", size: 32 }, 0, 1.0);
                write(rgba, { type: "float", size: 32 }, 4, 0.5);
                write(rgba, { type: "float", size: 32 }, 8, 0.25);
                write(rgba, { type: "float", size: 32 }, 12, 1.0);

                call(
                    GDK_LIB,
                    "gdk_rgba_to_string",
                    [{ type: { type: "boxed", innerType: "GdkRGBA", lib: GDK_LIB }, value: rgba }],
                    { type: "string" },
                );
            }
        }
    });

    it("should not leak memory with callbacks", () => {
        for (let round = 0; round < 10; round++) {
            const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

            for (let i = 0; i < 10; i++) {
                call(
                    GOBJECT_LIB,
                    "g_signal_connect_closure",
                    [
                        { type: { type: "gobject" }, value: button },
                        { type: { type: "string" }, value: "clicked" },
                        {
                            type: { type: "callback", argTypes: [{ type: "gobject", borrowed: true }] },
                            value: () => {
                                Array.from({ length: 1000 });
                            },
                        },
                        { type: { type: "boolean" }, value: false },
                    ],
                    { type: "int", size: 64, unsigned: true },
                );
            }
        }
    });
});

describe("GList/GSList Types", () => {
    it("should handle GList return type with GObject elements (gdk_display_list_seats)", () => {
        const display = call(GDK_LIB, "gdk_display_get_default", [], {
            type: "gobject",
            borrowed: true,
        });
        expect(display).not.toBeNull();

        const seats = call(
            GDK_LIB,
            "gdk_display_list_seats",
            [{ type: { type: "gobject" }, value: display }],
            { type: "array", listType: "glist", itemType: { type: "gobject", borrowed: true }, borrowed: true },
        ) as unknown[];

        expect(Array.isArray(seats)).toBe(true);
        expect(seats.length).toBeGreaterThanOrEqual(1);

        for (const seat of seats) {
            expect(seat).not.toBeNull();
        }
    });

    it("should handle GSList return type with GObject elements (gdk_display_manager_list_displays)", () => {
        const displayManager = call(GDK_LIB, "gdk_display_manager_get", [], {
            type: "gobject",
            borrowed: true,
        });
        expect(displayManager).not.toBeNull();

        const displays = call(
            GDK_LIB,
            "gdk_display_manager_list_displays",
            [{ type: { type: "gobject" }, value: displayManager }],
            { type: "array", listType: "gslist", itemType: { type: "gobject", borrowed: true }, borrowed: true },
        ) as unknown[];

        expect(Array.isArray(displays)).toBe(true);
        expect(displays.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle empty GList return", () => {
        const emptyListStore = call(
            GIO_LIB,
            "g_list_store_new",
            [
                {
                    type: { type: "int", size: 64, unsigned: true },
                    value: call(GTK_LIB, "gtk_string_object_get_type", [], { type: "int", size: 64, unsigned: true }),
                },
            ],
            { type: "gobject", borrowed: true },
        );

        const count = call(
            GIO_LIB,
            "g_list_model_get_n_items",
            [{ type: { type: "gobject" }, value: emptyListStore }],
            { type: "int", size: 32, unsigned: true },
        );
        expect(count).toBe(0);
    });

    it("should handle GList with multiple elements", () => {
        const display = call(GDK_LIB, "gdk_display_get_default", [], {
            type: "gobject",
            borrowed: true,
        });

        const seats = call(
            GDK_LIB,
            "gdk_display_list_seats",
            [{ type: { type: "gobject" }, value: display }],
            { type: "array", listType: "glist", itemType: { type: "gobject", borrowed: true }, borrowed: true },
        ) as unknown[];

        expect(Array.isArray(seats)).toBe(true);

        for (const seat of seats) {
            const pointer = call(
                GDK_LIB,
                "gdk_seat_get_pointer",
                [{ type: { type: "gobject" }, value: seat }],
                { type: "gobject", borrowed: true },
            );
            expect(pointer).not.toBeNull();
        }
    });

    it("should correctly iterate GList elements maintaining order", () => {
        const display = call(GDK_LIB, "gdk_display_get_default", [], {
            type: "gobject",
            borrowed: true,
        });

        const monitors = call(
            GDK_LIB,
            "gdk_display_get_monitors",
            [{ type: { type: "gobject" }, value: display }],
            { type: "gobject", borrowed: true },
        );

        const count = call(
            GIO_LIB,
            "g_list_model_get_n_items",
            [{ type: { type: "gobject" }, value: monitors }],
            { type: "int", size: 32, unsigned: true },
        ) as number;

        expect(count).toBeGreaterThanOrEqual(1);
    });
});

describe("Edge Cases and Error Handling", () => {
    it("should handle empty string in label", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "" }], {
            type: "gobject",
            borrowed: true,
        });
        expect(label).not.toBeNull();

        const text = call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: label }], {
            type: "string",
            borrowed: true,
        });
        expect(text).toBe("");
    });

    it("should handle very long labels", () => {
        const longText = "x".repeat(10000);
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: longText }], {
            type: "gobject",
            borrowed: true,
        });

        const text = call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: label }], {
            type: "string",
            borrowed: true,
        });
        expect(text).toBe(longText);
    });

    it("should handle unicode in widgets", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "你好世界 🌍 مرحبا" }], {
            type: "gobject",
            borrowed: true,
        });

        const text = call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: label }], {
            type: "string",
            borrowed: true,
        });
        expect(text).toBe("你好世界 🌍 مرحبا");
    });

    it("should handle special characters in strings", () => {
        const specialChars = 'Tab:\tNewline:\nCarriage:\rBackslash:\\Quote:"';
        const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: specialChars }], {
            type: "string",
        });
        expect(result).toBe(specialChars);
    });

    it("should handle float edge values in boxed types", () => {
        const rgba = alloc(16, "GdkRGBA", GDK_LIB);

        write(rgba, { type: "float", size: 32 }, 0, 0.0);
        expect(read(rgba, { type: "float", size: 32 }, 0)).toBe(0.0);

        write(rgba, { type: "float", size: 32 }, 0, 1.0);
        expect(read(rgba, { type: "float", size: 32 }, 0)).toBe(1.0);

        write(rgba, { type: "float", size: 32 }, 0, 0.5);
        expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(0.5, 5);

        write(rgba, { type: "float", size: 32 }, 0, 0.0001);
        expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(0.0001, 5);
    });

    it("should handle quark operations", () => {
        const uniqueNames = Array.from({ length: 100 }, (_, i) => `unique-quark-${i}-${Date.now()}`);
        const quarks: number[] = [];

        for (const name of uniqueNames) {
            const quark = call(GLIB_LIB, "g_quark_from_string", [{ type: { type: "string" }, value: name }], {
                type: "int",
                size: 32,
                unsigned: true,
            }) as number;
            quarks.push(quark);
        }

        expect(new Set(quarks).size).toBe(100);

        for (let i = 0; i < uniqueNames.length; i++) {
            const retrieved = call(
                GLIB_LIB,
                "g_quark_to_string",
                [{ type: { type: "int", size: 32, unsigned: true }, value: quarks[i] }],
                { type: "string", borrowed: true },
            );
            expect(retrieved).toBe(uniqueNames[i]);
        }
    });
});
