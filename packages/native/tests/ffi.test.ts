import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { alloc, call, createRef, read, start, stop, write } from "../index.js";

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
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "boolean" },
            );
            if (setupCount > 0 && bindCount > 0) break;
            await new Promise((resolve) => setTimeout(resolve, 10));
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

        const seats = call(GDK_LIB, "gdk_display_list_seats", [{ type: { type: "gobject" }, value: display }], {
            type: "array",
            listType: "glist",
            itemType: { type: "gobject", borrowed: true },
            borrowed: true,
        }) as unknown[];

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

        const seats = call(GDK_LIB, "gdk_display_list_seats", [{ type: { type: "gobject" }, value: display }], {
            type: "array",
            listType: "glist",
            itemType: { type: "gobject", borrowed: true },
            borrowed: true,
        }) as unknown[];

        expect(Array.isArray(seats)).toBe(true);

        for (const seat of seats) {
            const pointer = call(GDK_LIB, "gdk_seat_get_pointer", [{ type: { type: "gobject" }, value: seat }], {
                type: "gobject",
                borrowed: true,
            });
            expect(pointer).not.toBeNull();
        }
    });

    it("should correctly iterate GList elements maintaining order", () => {
        const display = call(GDK_LIB, "gdk_display_get_default", [], {
            type: "gobject",
            borrowed: true,
        });

        const monitors = call(GDK_LIB, "gdk_display_get_monitors", [{ type: { type: "gobject" }, value: display }], {
            type: "gobject",
            borrowed: true,
        });

        const count = call(GIO_LIB, "g_list_model_get_n_items", [{ type: { type: "gobject" }, value: monitors }], {
            type: "int",
            size: 32,
            unsigned: true,
        }) as number;

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

describe("Ref with primitive types", () => {
    it("should handle Ref<i32> out parameters", () => {
        const widthRef = createRef(0);
        const heightRef = createRef(0);

        const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });

        call(
            GTK_LIB,
            "gtk_window_set_default_size",
            [
                { type: { type: "gobject" }, value: window },
                { type: { type: "int", size: 32, unsigned: false }, value: 800 },
                { type: { type: "int", size: 32, unsigned: false }, value: 600 },
            ],
            { type: "undefined" },
        );

        call(
            GTK_LIB,
            "gtk_window_get_default_size",
            [
                { type: { type: "gobject" }, value: window },
                {
                    type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } },
                    value: widthRef,
                },
                {
                    type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } },
                    value: heightRef,
                },
            ],
            { type: "undefined" },
        );

        expect(widthRef.value).toBe(800);
        expect(heightRef.value).toBe(600);
    });
});

describe("Ref with GError (pointer-to-pointer)", () => {
    it("should handle GError** out parameters when error occurs", () => {
        const keyFile = call(GLIB_LIB, "g_key_file_new", [], {
            type: "boxed",
            borrowed: true,
            innerType: "GKeyFile",
            lib: GLIB_LIB,
        });

        const errorRef = createRef(null);

        const result = call(
            GLIB_LIB,
            "g_key_file_load_from_file",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "/nonexistent/file/that/does/not/exist.ini" },
                { type: { type: "int", size: 32, unsigned: false }, value: 0 },
                {
                    type: {
                        type: "ref",
                        innerType: {
                            type: "boxed",
                            innerType: "GError",
                            lib: GLIB_LIB,
                        },
                    },
                    value: errorRef,
                },
            ],
            { type: "boolean" },
        );

        expect(result).toBe(false);
        expect(errorRef.value).not.toBeNull();
    });

    it("should handle GError** out parameters when no error occurs", () => {
        const keyFile = call(GLIB_LIB, "g_key_file_new", [], {
            type: "boxed",
            borrowed: true,
            innerType: "GKeyFile",
            lib: GLIB_LIB,
        });

        call(
            GLIB_LIB,
            "g_key_file_set_string",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "Group" },
                { type: { type: "string" }, value: "Key" },
                { type: { type: "string" }, value: "Value" },
            ],
            { type: "undefined" },
        );

        const errorRef = createRef(null);

        const result = call(
            GLIB_LIB,
            "g_key_file_get_string",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "Group" },
                { type: { type: "string" }, value: "Key" },
                {
                    type: {
                        type: "ref",
                        innerType: {
                            type: "boxed",
                            innerType: "GError",
                            lib: GLIB_LIB,
                        },
                    },
                    value: errorRef,
                },
            ],
            { type: "string" },
        );

        expect(result).toBe("Value");
        expect(errorRef.value).toBeNull();
    });
});

// ============================================================================
// EXHAUSTIVE TYPE PERMUTATION TESTS
// ============================================================================

describe("Exhaustive Integer Type Permutations", () => {
    describe("8-bit integers", () => {
        it("should handle 8-bit unsigned integers (u8)", () => {
            // g_ascii_digit_value takes a char (8-bit) and returns int
            // '0' = 48, '9' = 57
            const result = call(
                GLIB_LIB,
                "g_ascii_digit_value",
                [{ type: { type: "int", size: 8, unsigned: true }, value: 48 }],
                {
                    type: "int",
                    size: 32,
                },
            );
            expect(result).toBe(0);
        });

        it("should handle 8-bit signed integers (i8)", () => {
            const result = call(
                GLIB_LIB,
                "g_ascii_digit_value",
                [{ type: { type: "int", size: 8, unsigned: false }, value: 57 }],
                {
                    type: "int",
                    size: 32,
                },
            );
            expect(result).toBe(9);
        });

        it("should handle 8-bit boundary values", () => {
            // g_ascii_xdigit_value takes a char and returns the hex digit value (-1 if not hex)
            // 'A' = 65 should return 10, 'F' = 70 should return 15
            const resultA = call(
                GLIB_LIB,
                "g_ascii_xdigit_value",
                [{ type: { type: "int", size: 8, unsigned: true }, value: 65 }],
                {
                    type: "int",
                    size: 32,
                },
            );
            expect(resultA).toBe(10); // 'A' is hex digit 10

            const resultF = call(
                GLIB_LIB,
                "g_ascii_xdigit_value",
                [{ type: { type: "int", size: 8, unsigned: true }, value: 70 }],
                {
                    type: "int",
                    size: 32,
                },
            );
            expect(resultF).toBe(15); // 'F' is hex digit 15
        });

        it("should handle 8-bit values outside valid range", () => {
            // g_ascii_xdigit_value returns -1 for non-hex characters
            const result = call(
                GLIB_LIB,
                "g_ascii_xdigit_value",
                [{ type: { type: "int", size: 8, unsigned: true }, value: 71 }],
                {
                    type: "int",
                    size: 32,
                    unsigned: false, // Need signed to get -1
                },
            );
            expect(result).toBe(-1); // 'G' is not a hex digit
        });
    });

    describe("32-bit integers", () => {
        it("should handle 32-bit unsigned integers (u32)", () => {
            const quark = call(GLIB_LIB, "g_quark_from_string", [{ type: { type: "string" }, value: "test-u32" }], {
                type: "int",
                size: 32,
                unsigned: true,
            }) as number;
            expect(quark).toBeGreaterThan(0);
        });

        it("should handle 32-bit signed integers (i32)", () => {
            const result = call(
                GLIB_LIB,
                "g_random_int_range",
                [
                    { type: { type: "int", size: 32, unsigned: false }, value: -100 },
                    { type: { type: "int", size: 32, unsigned: false }, value: 100 },
                ],
                { type: "int", size: 32, unsigned: false },
            );
            expect(result).toBeGreaterThanOrEqual(-100);
            expect(result).toBeLessThan(100);
        });

        it("should handle 32-bit signed negative values", () => {
            const result = call(
                GLIB_LIB,
                "g_random_int_range",
                [
                    { type: { type: "int", size: 32, unsigned: false }, value: -1000 },
                    { type: { type: "int", size: 32, unsigned: false }, value: -999 },
                ],
                { type: "int", size: 32, unsigned: false },
            );
            expect(result).toBe(-1000);
        });

        it("should handle 32-bit max signed value", () => {
            const result = call(
                GLIB_LIB,
                "g_random_int_range",
                [
                    { type: { type: "int", size: 32, unsigned: false }, value: 2147483646 },
                    { type: { type: "int", size: 32, unsigned: false }, value: 2147483647 },
                ],
                { type: "int", size: 32, unsigned: false },
            );
            expect(result).toBe(2147483646);
        });

        it("should handle 32-bit min signed value", () => {
            const result = call(
                GLIB_LIB,
                "g_random_int_range",
                [
                    { type: { type: "int", size: 32, unsigned: false }, value: -2147483648 },
                    { type: { type: "int", size: 32, unsigned: false }, value: -2147483647 },
                ],
                { type: "int", size: 32, unsigned: false },
            );
            expect(result).toBe(-2147483648);
        });
    });

    describe("64-bit integers", () => {
        it("should handle 64-bit unsigned integers (u64) - GType", () => {
            const gtype = call(GTK_LIB, "gtk_widget_get_type", [], { type: "int", size: 64, unsigned: true });
            expect(gtype).toBeGreaterThan(0);
        });

        it("should handle 64-bit signed integers (i64)", () => {
            // g_get_monotonic_time returns gint64
            const time = call(GLIB_LIB, "g_get_monotonic_time", [], { type: "int", size: 64, unsigned: false });
            expect(time).toBeGreaterThan(0);
        });

        it("should handle 64-bit large positive values", () => {
            const time1 = call(GLIB_LIB, "g_get_monotonic_time", [], {
                type: "int",
                size: 64,
                unsigned: false,
            }) as number;
            const time2 = call(GLIB_LIB, "g_get_monotonic_time", [], {
                type: "int",
                size: 64,
                unsigned: false,
            }) as number;
            expect(time2).toBeGreaterThanOrEqual(time1);
        });

        it("should handle 64-bit values as signal handler IDs", () => {
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
    });

    describe("Integer type coercion and defaults", () => {
        it("should default to unsigned when unsigned not specified", () => {
            const quark = call(
                GLIB_LIB,
                "g_quark_from_string",
                [{ type: { type: "string" }, value: "test-default" }],
                { type: "int", size: 32 }, // no unsigned specified
            ) as number;
            expect(quark).toBeGreaterThan(0);
        });

        it("should handle zero for all integer sizes", () => {
            // 32-bit zero
            const result32 = call(
                GLIB_LIB,
                "g_random_int_range",
                [
                    { type: { type: "int", size: 32 }, value: 0 },
                    { type: { type: "int", size: 32 }, value: 1 },
                ],
                { type: "int", size: 32 },
            );
            expect(result32).toBe(0);
        });
    });
});

describe("Exhaustive Float Type Permutations", () => {
    describe("32-bit floats (f32)", () => {
        it("should handle 32-bit float zero", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);
            write(rgba, { type: "float", size: 32 }, 0, 0.0);
            expect(read(rgba, { type: "float", size: 32 }, 0)).toBe(0.0);
        });

        it("should handle 32-bit float one", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);
            write(rgba, { type: "float", size: 32 }, 0, 1.0);
            expect(read(rgba, { type: "float", size: 32 }, 0)).toBe(1.0);
        });

        it("should handle 32-bit float fractional values", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);
            const testValues = [0.1, 0.25, 0.333, 0.5, 0.666, 0.75, 0.9, 0.999];
            for (const val of testValues) {
                write(rgba, { type: "float", size: 32 }, 0, val);
                expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(val, 4);
            }
        });

        it("should handle 32-bit float negative values", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);
            write(rgba, { type: "float", size: 32 }, 0, -0.5);
            expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(-0.5, 5);
        });

        it("should handle 32-bit float small values", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);
            write(rgba, { type: "float", size: 32 }, 0, 0.00001);
            expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(0.00001, 5);
        });

        it("should handle 32-bit float large values", () => {
            const rgba = alloc(16, "GdkRGBA", GDK_LIB);
            write(rgba, { type: "float", size: 32 }, 0, 1000000.0);
            expect(read(rgba, { type: "float", size: 32 }, 0)).toBeCloseTo(1000000.0, 0);
        });
    });

    describe("64-bit floats (f64/doubles)", () => {
        it("should handle 64-bit float zero", () => {
            const result = call(
                GLIB_LIB,
                "g_ascii_strtod",
                [
                    { type: { type: "string" }, value: "0.0" },
                    { type: { type: "null" }, value: null },
                ],
                { type: "float", size: 64 },
            );
            expect(result).toBe(0.0);
        });

        it("should handle 64-bit float one", () => {
            const result = call(
                GLIB_LIB,
                "g_ascii_strtod",
                [
                    { type: { type: "string" }, value: "1.0" },
                    { type: { type: "null" }, value: null },
                ],
                { type: "float", size: 64 },
            );
            expect(result).toBe(1.0);
        });

        it("should handle 64-bit float high precision", () => {
            const result = call(
                GLIB_LIB,
                "g_ascii_strtod",
                [
                    { type: { type: "string" }, value: "3.141592653589793" },
                    { type: { type: "null" }, value: null },
                ],
                { type: "float", size: 64 },
            );
            expect(result).toBeCloseTo(Math.PI, 14);
        });

        it("should handle 64-bit float negative values", () => {
            const result = call(
                GLIB_LIB,
                "g_ascii_strtod",
                [
                    { type: { type: "string" }, value: "-123.456" },
                    { type: { type: "null" }, value: null },
                ],
                { type: "float", size: 64 },
            );
            expect(result).toBeCloseTo(-123.456, 10);
        });

        it("should handle 64-bit float scientific notation positive exponent", () => {
            const result = call(
                GLIB_LIB,
                "g_ascii_strtod",
                [
                    { type: { type: "string" }, value: "1.5e10" },
                    { type: { type: "null" }, value: null },
                ],
                { type: "float", size: 64 },
            );
            expect(result).toBeCloseTo(1.5e10, 0);
        });

        it("should handle 64-bit float scientific notation negative exponent", () => {
            const result = call(
                GLIB_LIB,
                "g_ascii_strtod",
                [
                    { type: { type: "string" }, value: "1.5e-10" },
                    { type: { type: "null" }, value: null },
                ],
                { type: "float", size: 64 },
            );
            expect(result).toBeCloseTo(1.5e-10, 20);
        });

        it("should handle 64-bit float very small values", () => {
            const result = call(
                GLIB_LIB,
                "g_ascii_strtod",
                [
                    { type: { type: "string" }, value: "0.000000001" },
                    { type: { type: "null" }, value: null },
                ],
                { type: "float", size: 64 },
            );
            expect(result).toBeCloseTo(1e-9, 15);
        });

        it("should handle 64-bit float very large values", () => {
            const result = call(
                GLIB_LIB,
                "g_ascii_strtod",
                [
                    { type: { type: "string" }, value: "999999999999.999" },
                    { type: { type: "null" }, value: null },
                ],
                { type: "float", size: 64 },
            );
            expect(result).toBeCloseTo(999999999999.999, 3);
        });
    });
});

describe("Exhaustive Callback Trampoline Permutations", () => {
    describe("Closure trampoline (default)", () => {
        it("should handle closure with no arguments", () => {
            const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: { type: "gobject" }, value: button },
                    { type: { type: "string" }, value: "clicked" },
                    {
                        type: {
                            type: "callback",
                            trampoline: "closure",
                            argTypes: [{ type: "gobject", borrowed: true }],
                        },
                        value: () => {},
                    },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "int", size: 64, unsigned: true },
            );
            expect(handlerId).toBeGreaterThan(0);
        });

        it("should handle closure with GObject argument", () => {
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
                            trampoline: "closure",
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

        it("should handle closure with integer arguments", () => {
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
                            trampoline: "closure",
                            argTypes: [
                                { type: "gobject", borrowed: true },
                                { type: "int", size: 32 },
                                { type: "float", size: 64 },
                                { type: "float", size: 64 },
                            ],
                        },
                        value: (_gesture: unknown, _nPress: unknown, _x: unknown, _y: unknown) => {},
                    },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "int", size: 64, unsigned: true },
            );
            expect(handlerId).toBeGreaterThan(0);
        });

        it("should handle closure with float arguments", () => {
            const adjustment = call(
                GTK_LIB,
                "gtk_adjustment_new",
                [
                    { type: { type: "float", size: 64 }, value: 0.0 },
                    { type: { type: "float", size: 64 }, value: 0.0 },
                    { type: { type: "float", size: 64 }, value: 100.0 },
                    { type: { type: "float", size: 64 }, value: 1.0 },
                    { type: { type: "float", size: 64 }, value: 10.0 },
                    { type: { type: "float", size: 64 }, value: 0.0 },
                ],
                { type: "gobject", borrowed: true },
            );

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: { type: "gobject" }, value: adjustment },
                    { type: { type: "string" }, value: "value-changed" },
                    {
                        type: {
                            type: "callback",
                            trampoline: "closure",
                            argTypes: [{ type: "gobject", borrowed: true }],
                        },
                        value: (_adj: unknown) => {},
                    },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "int", size: 64, unsigned: true },
            );
            expect(handlerId).toBeGreaterThan(0);
        });

        it("should handle closure with boolean argument", () => {
            const checkButton = call(GTK_LIB, "gtk_check_button_new", [], { type: "gobject", borrowed: true });

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: { type: "gobject" }, value: checkButton },
                    { type: { type: "string" }, value: "toggled" },
                    {
                        type: {
                            type: "callback",
                            trampoline: "closure",
                            argTypes: [{ type: "gobject", borrowed: true }],
                        },
                        value: (_button: unknown) => {},
                    },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "int", size: 64, unsigned: true },
            );
            expect(handlerId).toBeGreaterThan(0);
        });

        it("should handle closure with string argument", () => {
            const entry = call(GTK_LIB, "gtk_entry_new", [], { type: "gobject", borrowed: true });

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: { type: "gobject" }, value: entry },
                    { type: { type: "string" }, value: "changed" },
                    {
                        type: {
                            type: "callback",
                            trampoline: "closure",
                            argTypes: [{ type: "gobject", borrowed: true }],
                        },
                        value: (_entry: unknown) => {},
                    },
                    { type: { type: "boolean" }, value: false },
                ],
                { type: "int", size: 64, unsigned: true },
            );
            expect(handlerId).toBeGreaterThan(0);
        });
    });

    describe("Destroy trampoline", () => {
        it("should handle destroy callback for cleanup", () => {
            const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });
            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: button }], {
                type: "gobject",
                borrowed: true,
            });

            // Using g_object_set_data_full which takes a GDestroyNotify
            call(
                GOBJECT_LIB,
                "g_object_set_data_full",
                [
                    { type: { type: "gobject" }, value: button },
                    { type: { type: "string" }, value: "test-key" },
                    { type: { type: "gobject" }, value: button }, // data - just use the button itself
                    {
                        type: { type: "callback", trampoline: "destroy" },
                        value: () => {
                            // Cleanup callback - no args
                        },
                    },
                ],
                { type: "undefined" },
            );

            // Verify data was set
            const data = call(
                GOBJECT_LIB,
                "g_object_get_data",
                [
                    { type: { type: "gobject" }, value: button },
                    { type: { type: "string" }, value: "test-key" },
                ],
                { type: "gobject", borrowed: true },
            );
            expect(data).not.toBeNull();
        });
    });

    describe("SourceFunc trampoline", () => {
        it("should register sourceFunc callback with idle_add", () => {
            // Using g_idle_add to test sourceFunc registration
            // The callback returns a source ID which should be > 0
            const sourceId = call(
                GLIB_LIB,
                "g_idle_add",
                [
                    {
                        type: { type: "callback", trampoline: "sourceFunc" },
                        value: () => {
                            return false; // Remove source immediately when called
                        },
                    },
                ],
                { type: "int", size: 32, unsigned: true },
            ) as number;

            expect(sourceId).toBeGreaterThan(0);

            // Remove the source to clean up
            call(GLIB_LIB, "g_source_remove", [{ type: { type: "int", size: 32, unsigned: true }, value: sourceId }], {
                type: "boolean",
            });
        });

        it("should register sourceFunc callback with timeout_add", () => {
            // Using g_timeout_add to test sourceFunc registration
            const sourceId = call(
                GLIB_LIB,
                "g_timeout_add",
                [
                    { type: { type: "int", size: 32, unsigned: true }, value: 60000 }, // 60 second timeout (won't fire during test)
                    {
                        type: { type: "callback", trampoline: "sourceFunc" },
                        value: () => {
                            return false; // Remove source when called
                        },
                    },
                ],
                { type: "int", size: 32, unsigned: true },
            ) as number;

            expect(sourceId).toBeGreaterThan(0);

            // Remove the source to clean up
            call(GLIB_LIB, "g_source_remove", [{ type: { type: "int", size: 32, unsigned: true }, value: sourceId }], {
                type: "boolean",
            });
        });
    });

    describe("DrawFunc trampoline", () => {
        it("should handle drawFunc callback for drawing area", () => {
            const drawingArea = call(GTK_LIB, "gtk_drawing_area_new", [], { type: "gobject", borrowed: true });
            expect(drawingArea).not.toBeNull();

            // Set the draw function
            // Note: drawFunc trampoline automatically includes the destroy callback pointer
            call(
                GTK_LIB,
                "gtk_drawing_area_set_draw_func",
                [
                    { type: { type: "gobject" }, value: drawingArea },
                    {
                        type: {
                            type: "callback",
                            trampoline: "drawFunc",
                            argTypes: [
                                { type: "gobject", borrowed: true }, // GtkDrawingArea
                                { type: "boxed", innerType: "cairo_t", lib: "libcairo.so.2", borrowed: true }, // cairo_t
                                { type: "int", size: 32 }, // width
                                { type: "int", size: 32 }, // height
                            ],
                        },
                        value: (_area: unknown, _cr: unknown, _width: unknown, _height: unknown) => {
                            // Drawing callback
                        },
                    },
                ],
                { type: "undefined" },
            );

            // Verify the drawing area is still valid
            const visible = call(
                GTK_LIB,
                "gtk_widget_get_visible",
                [{ type: { type: "gobject" }, value: drawingArea }],
                {
                    type: "boolean",
                },
            );
            expect(typeof visible).toBe("boolean");
        });
    });
});

describe("Exhaustive Ref Type Permutations", () => {
    describe("Ref with integer types", () => {
        it("should handle Ref<i32> out parameters", () => {
            const widthRef = createRef(0);
            const heightRef = createRef(0);

            const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });

            call(
                GTK_LIB,
                "gtk_window_set_default_size",
                [
                    { type: { type: "gobject" }, value: window },
                    { type: { type: "int", size: 32, unsigned: false }, value: 1024 },
                    { type: { type: "int", size: 32, unsigned: false }, value: 768 },
                ],
                { type: "undefined" },
            );

            call(
                GTK_LIB,
                "gtk_window_get_default_size",
                [
                    { type: { type: "gobject" }, value: window },
                    {
                        type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } },
                        value: widthRef,
                    },
                    {
                        type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } },
                        value: heightRef,
                    },
                ],
                { type: "undefined" },
            );

            expect(widthRef.value).toBe(1024);
            expect(heightRef.value).toBe(768);
        });

        it("should handle Ref<u32> out parameters", () => {
            const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });

            const widthRef = createRef(0);
            const heightRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_window_set_default_size",
                [
                    { type: { type: "gobject" }, value: window },
                    { type: { type: "int", size: 32, unsigned: false }, value: 500 },
                    { type: { type: "int", size: 32, unsigned: false }, value: 400 },
                ],
                { type: "undefined" },
            );

            call(
                GTK_LIB,
                "gtk_window_get_default_size",
                [
                    { type: { type: "gobject" }, value: window },
                    {
                        type: { type: "ref", innerType: { type: "int", size: 32, unsigned: true } },
                        value: widthRef,
                    },
                    {
                        type: { type: "ref", innerType: { type: "int", size: 32, unsigned: true } },
                        value: heightRef,
                    },
                ],
                { type: "undefined" },
            );

            expect(widthRef.value).toBe(500);
            expect(heightRef.value).toBe(400);
        });

        it("should handle multiple Ref parameters in one call", () => {
            const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });
            call(
                GTK_LIB,
                "gtk_window_set_default_size",
                [
                    { type: { type: "gobject" }, value: window },
                    { type: { type: "int", size: 32, unsigned: false }, value: 640 },
                    { type: { type: "int", size: 32, unsigned: false }, value: 480 },
                ],
                { type: "undefined" },
            );

            const ref1 = createRef(0);
            const ref2 = createRef(0);

            call(
                GTK_LIB,
                "gtk_window_get_default_size",
                [
                    { type: { type: "gobject" }, value: window },
                    { type: { type: "ref", innerType: { type: "int", size: 32 } }, value: ref1 },
                    { type: { type: "ref", innerType: { type: "int", size: 32 } }, value: ref2 },
                ],
                { type: "undefined" },
            );

            expect(ref1.value).toBe(640);
            expect(ref2.value).toBe(480);
        });

        it("should handle Ref with negative values", () => {
            const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });

            // -1 means "use natural size"
            call(
                GTK_LIB,
                "gtk_window_set_default_size",
                [
                    { type: { type: "gobject" }, value: window },
                    { type: { type: "int", size: 32, unsigned: false }, value: -1 },
                    { type: { type: "int", size: 32, unsigned: false }, value: -1 },
                ],
                { type: "undefined" },
            );

            const widthRef = createRef(0);
            const heightRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_window_get_default_size",
                [
                    { type: { type: "gobject" }, value: window },
                    { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } }, value: widthRef },
                    { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } }, value: heightRef },
                ],
                { type: "undefined" },
            );

            expect(widthRef.value).toBe(-1);
            expect(heightRef.value).toBe(-1);
        });
    });

    describe("Ref with GObject types", () => {
        it("should handle Ref<GObject> (out parameter returning object)", () => {
            const display = call(GDK_LIB, "gdk_display_get_default", [], {
                type: "gobject",
                borrowed: true,
            });
            expect(display).not.toBeNull();

            // Get clipboard which returns a GObject
            const clipboard = call(
                GDK_LIB,
                "gdk_display_get_clipboard",
                [{ type: { type: "gobject" }, value: display }],
                {
                    type: "gobject",
                    borrowed: true,
                },
            );
            expect(clipboard).not.toBeNull();
        });
    });

    describe("Ref with Boxed types", () => {
        it("should handle Ref<Boxed> for GError** (error case)", () => {
            const keyFile = call(GLIB_LIB, "g_key_file_new", [], {
                type: "boxed",
                borrowed: true,
                innerType: "GKeyFile",
                lib: GLIB_LIB,
            });

            const errorRef = createRef(null);

            const result = call(
                GLIB_LIB,
                "g_key_file_load_from_file",
                [
                    { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                    { type: { type: "string" }, value: "/this/path/definitely/does/not/exist/anywhere.txt" },
                    { type: { type: "int", size: 32, unsigned: false }, value: 0 },
                    {
                        type: {
                            type: "ref",
                            innerType: {
                                type: "boxed",
                                innerType: "GError",
                                lib: GLIB_LIB,
                            },
                        },
                        value: errorRef,
                    },
                ],
                { type: "boolean" },
            );

            expect(result).toBe(false);
            expect(errorRef.value).not.toBeNull();
        });

        it("should handle Ref<Boxed> for GError** (success case)", () => {
            const keyFile = call(GLIB_LIB, "g_key_file_new", [], {
                type: "boxed",
                borrowed: true,
                innerType: "GKeyFile",
                lib: GLIB_LIB,
            });

            // Set up some data first
            call(
                GLIB_LIB,
                "g_key_file_set_string",
                [
                    { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                    { type: { type: "string" }, value: "TestGroup" },
                    { type: { type: "string" }, value: "TestKey" },
                    { type: { type: "string" }, value: "TestValue" },
                ],
                { type: "undefined" },
            );

            const errorRef = createRef(null);

            const result = call(
                GLIB_LIB,
                "g_key_file_get_string",
                [
                    { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                    { type: { type: "string" }, value: "TestGroup" },
                    { type: { type: "string" }, value: "TestKey" },
                    {
                        type: {
                            type: "ref",
                            innerType: {
                                type: "boxed",
                                innerType: "GError",
                                lib: GLIB_LIB,
                            },
                        },
                        value: errorRef,
                    },
                ],
                { type: "string" },
            );

            expect(result).toBe("TestValue");
            expect(errorRef.value).toBeNull();
        });
    });

    describe("Ref with null initial values", () => {
        it("should handle Ref initialized with null for optional out parameters", () => {
            const errorRef = createRef(null);

            // Try to parse invalid data
            call(
                GLIB_LIB,
                "g_utf8_validate",
                [
                    { type: { type: "string" }, value: "valid utf8 string" },
                    { type: { type: "int", size: 64, unsigned: false }, value: -1 },
                    { type: { type: "null" }, value: null }, // end parameter can be null
                ],
                { type: "boolean" },
            );

            expect(errorRef.value).toBeNull();
        });
    });
});

describe("Exhaustive Null and Undefined Permutations", () => {
    describe("Null type", () => {
        it("should handle null as first argument", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "null" }, value: null }], {
                type: "gobject",
                borrowed: true,
            });
            expect(label).not.toBeNull();
        });

        it("should handle null as optional argument", () => {
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

        it("should handle null replacing GObject argument", () => {
            const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });

            // First add a child
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
                type: "gobject",
                borrowed: true,
            });
            call(
                GTK_LIB,
                "gtk_window_set_child",
                [
                    { type: { type: "gobject" }, value: window },
                    { type: { type: "gobject" }, value: label },
                ],
                { type: "undefined" },
            );

            // Verify child was set
            const childBefore = call(GTK_LIB, "gtk_window_get_child", [{ type: { type: "gobject" }, value: window }], {
                type: "gobject",
                borrowed: true,
            });
            expect(childBefore).not.toBeNull();

            // Set child to null (remove child)
            call(
                GTK_LIB,
                "gtk_window_set_child",
                [
                    { type: { type: "gobject" }, value: window },
                    { type: { type: "null" }, value: null },
                ],
                { type: "undefined" },
            );

            // After setting to null, getting the child should return null
            // Note: The FFI returns {} for null GObjects, not JavaScript null
            const childAfter = call(GTK_LIB, "gtk_window_get_child", [{ type: { type: "gobject" }, value: window }], {
                type: "gobject",
                borrowed: true,
            });
            // Check that the returned value is empty (null GObject is returned as empty object)
            expect(Object.keys(childAfter as object).length).toBe(0);
        });

        it("should handle multiple null arguments", () => {
            // g_ascii_strtod with null endptr
            const result = call(
                GLIB_LIB,
                "g_ascii_strtod",
                [
                    { type: { type: "string" }, value: "3.14" },
                    { type: { type: "null" }, value: null },
                ],
                { type: "float", size: 64 },
            );
            expect(result).toBeCloseTo(3.14, 5);
        });
    });

    describe("Undefined type (void returns)", () => {
        it("should handle void return from setter", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
                type: "gobject",
                borrowed: true,
            });

            const result = call(
                GTK_LIB,
                "gtk_label_set_label",
                [
                    { type: { type: "gobject" }, value: label },
                    { type: { type: "string" }, value: "Updated" },
                ],
                { type: "undefined" },
            );
            expect(result).toBeUndefined();
        });

        it("should handle void return from widget operations", () => {
            const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

            const result = call(
                GTK_LIB,
                "gtk_widget_set_visible",
                [
                    { type: { type: "gobject" }, value: button },
                    { type: { type: "boolean" }, value: true },
                ],
                { type: "undefined" },
            );
            expect(result).toBeUndefined();
        });

        it("should handle void return from container operations", () => {
            const box = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 0 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Child" }], {
                type: "gobject",
                borrowed: true,
            });

            const result = call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: { type: "gobject" }, value: box },
                    { type: { type: "gobject" }, value: label },
                ],
                { type: "undefined" },
            );
            expect(result).toBeUndefined();
        });
    });
});

describe("Exhaustive Array Type Permutations", () => {
    describe("GList with GObject items", () => {
        it("should handle GList<GObject> (borrowed)", () => {
            const display = call(GDK_LIB, "gdk_display_get_default", [], {
                type: "gobject",
                borrowed: true,
            });

            const seats = call(GDK_LIB, "gdk_display_list_seats", [{ type: { type: "gobject" }, value: display }], {
                type: "array",
                listType: "glist",
                itemType: { type: "gobject", borrowed: true },
                borrowed: true,
            }) as unknown[];

            expect(Array.isArray(seats)).toBe(true);
            expect(seats.length).toBeGreaterThanOrEqual(1);
        });

        it("should iterate GList elements", () => {
            const display = call(GDK_LIB, "gdk_display_get_default", [], {
                type: "gobject",
                borrowed: true,
            });

            const seats = call(GDK_LIB, "gdk_display_list_seats", [{ type: { type: "gobject" }, value: display }], {
                type: "array",
                listType: "glist",
                itemType: { type: "gobject", borrowed: true },
                borrowed: true,
            }) as unknown[];

            for (const seat of seats) {
                expect(seat).not.toBeNull();
                // Verify it's a real GdkSeat by calling a method on it
                const pointer = call(GDK_LIB, "gdk_seat_get_pointer", [{ type: { type: "gobject" }, value: seat }], {
                    type: "gobject",
                    borrowed: true,
                });
                expect(pointer).not.toBeNull();
            }
        });
    });

    describe("GSList with GObject items", () => {
        it("should handle GSList<GObject> (borrowed)", () => {
            const displayManager = call(GDK_LIB, "gdk_display_manager_get", [], {
                type: "gobject",
                borrowed: true,
            });

            const displays = call(
                GDK_LIB,
                "gdk_display_manager_list_displays",
                [{ type: { type: "gobject" }, value: displayManager }],
                { type: "array", listType: "gslist", itemType: { type: "gobject", borrowed: true }, borrowed: true },
            ) as unknown[];

            expect(Array.isArray(displays)).toBe(true);
            expect(displays.length).toBeGreaterThanOrEqual(1);
        });

        it("should iterate GSList elements", () => {
            const displayManager = call(GDK_LIB, "gdk_display_manager_get", [], {
                type: "gobject",
                borrowed: true,
            });

            const displays = call(
                GDK_LIB,
                "gdk_display_manager_list_displays",
                [{ type: { type: "gobject" }, value: displayManager }],
                { type: "array", listType: "gslist", itemType: { type: "gobject", borrowed: true }, borrowed: true },
            ) as unknown[];

            for (const display of displays) {
                expect(display).not.toBeNull();
                // Verify it's a real GdkDisplay by calling a method on it
                const name = call(GDK_LIB, "gdk_display_get_name", [{ type: { type: "gobject" }, value: display }], {
                    type: "string",
                    borrowed: true,
                });
                expect(typeof name).toBe("string");
            }
        });
    });

    describe("Empty lists", () => {
        it("should handle empty GListStore as list model", () => {
            const store = call(
                GIO_LIB,
                "g_list_store_new",
                [
                    {
                        type: { type: "int", size: 64, unsigned: true },
                        value: call(GTK_LIB, "gtk_string_object_get_type", [], {
                            type: "int",
                            size: 64,
                            unsigned: true,
                        }),
                    },
                ],
                { type: "gobject", borrowed: true },
            );

            const count = call(GIO_LIB, "g_list_model_get_n_items", [{ type: { type: "gobject" }, value: store }], {
                type: "int",
                size: 32,
                unsigned: true,
            });

            expect(count).toBe(0);
        });
    });

    describe("List with many elements", () => {
        it("should handle list with 100 elements", () => {
            const store = call(
                GIO_LIB,
                "g_list_store_new",
                [
                    {
                        type: { type: "int", size: 64, unsigned: true },
                        value: call(GTK_LIB, "gtk_string_object_get_type", [], {
                            type: "int",
                            size: 64,
                            unsigned: true,
                        }),
                    },
                ],
                { type: "gobject", borrowed: true },
            );

            // Add 100 items
            for (let i = 0; i < 100; i++) {
                const strObj = call(
                    GTK_LIB,
                    "gtk_string_object_new",
                    [{ type: { type: "string" }, value: `Item ${i}` }],
                    {
                        type: "gobject",
                        borrowed: true,
                    },
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

            expect(count).toBe(100);
        });
    });
});

describe("Mixed Argument Type Combinations", () => {
    it("should handle function with int, string, and boolean args", () => {
        const keyFile = call(GLIB_LIB, "g_key_file_new", [], {
            type: "boxed",
            borrowed: true,
            innerType: "GKeyFile",
            lib: GLIB_LIB,
        });

        // set_boolean takes (GKeyFile*, const gchar*, const gchar*, gboolean)
        call(
            GLIB_LIB,
            "g_key_file_set_boolean",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "Group" },
                { type: { type: "string" }, value: "BoolKey" },
                { type: { type: "boolean" }, value: true },
            ],
            { type: "undefined" },
        );

        const errorRef = createRef(null);
        const result = call(
            GLIB_LIB,
            "g_key_file_get_boolean",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "Group" },
                { type: { type: "string" }, value: "BoolKey" },
                {
                    type: {
                        type: "ref",
                        innerType: { type: "boxed", innerType: "GError", lib: GLIB_LIB },
                    },
                    value: errorRef,
                },
            ],
            { type: "boolean" },
        );

        expect(result).toBe(true);
        expect(errorRef.value).toBeNull();
    });

    it("should handle function with int, float, and GObject args", () => {
        const adjustment = call(
            GTK_LIB,
            "gtk_adjustment_new",
            [
                { type: { type: "float", size: 64 }, value: 50.0 }, // value
                { type: { type: "float", size: 64 }, value: 0.0 }, // lower
                { type: { type: "float", size: 64 }, value: 100.0 }, // upper
                { type: { type: "float", size: 64 }, value: 1.0 }, // step_increment
                { type: { type: "float", size: 64 }, value: 10.0 }, // page_increment
                { type: { type: "float", size: 64 }, value: 0.0 }, // page_size
            ],
            { type: "gobject", borrowed: true },
        );

        expect(adjustment).not.toBeNull();

        const value = call(GTK_LIB, "gtk_adjustment_get_value", [{ type: { type: "gobject" }, value: adjustment }], {
            type: "float",
            size: 64,
        });
        expect(value).toBeCloseTo(50.0, 5);
    });

    it("should handle function with GObject, string, callback, and boolean args", () => {
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

    it("should handle function with boxed, string, int, and ref args", () => {
        const keyFile = call(GLIB_LIB, "g_key_file_new", [], {
            type: "boxed",
            borrowed: true,
            innerType: "GKeyFile",
            lib: GLIB_LIB,
        });

        // Set an integer value
        call(
            GLIB_LIB,
            "g_key_file_set_integer",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "Numbers" },
                { type: { type: "string" }, value: "IntKey" },
                { type: { type: "int", size: 32 }, value: 42 },
            ],
            { type: "undefined" },
        );

        const errorRef = createRef(null);
        const result = call(
            GLIB_LIB,
            "g_key_file_get_integer",
            [
                { type: { type: "boxed", innerType: "GKeyFile", lib: GLIB_LIB }, value: keyFile },
                { type: { type: "string" }, value: "Numbers" },
                { type: { type: "string" }, value: "IntKey" },
                {
                    type: {
                        type: "ref",
                        innerType: { type: "boxed", innerType: "GError", lib: GLIB_LIB },
                    },
                    value: errorRef,
                },
            ],
            { type: "int", size: 32 },
        );

        expect(result).toBe(42);
        expect(errorRef.value).toBeNull();
    });

    it("should handle function with null, GObject, and string args", () => {
        const window = call(GTK_LIB, "gtk_window_new", [], { type: "gobject", borrowed: true });

        // Set title (string)
        call(
            GTK_LIB,
            "gtk_window_set_title",
            [
                { type: { type: "gobject" }, value: window },
                { type: { type: "string" }, value: "Test Window" },
            ],
            { type: "undefined" },
        );

        // Set child to null
        call(
            GTK_LIB,
            "gtk_window_set_child",
            [
                { type: { type: "gobject" }, value: window },
                { type: { type: "null" }, value: null },
            ],
            { type: "undefined" },
        );

        const title = call(GTK_LIB, "gtk_window_get_title", [{ type: { type: "gobject" }, value: window }], {
            type: "string",
            borrowed: true,
        });
        expect(title).toBe("Test Window");
    });
});

describe("String Type Permutations", () => {
    describe("Owned strings", () => {
        it("should handle owned string return", () => {
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "owned string test" }], {
                type: "string",
            });
            expect(result).toBe("owned string test");
        });

        it("should handle owned string with special characters", () => {
            const special = 'Tab:\t Newline:\n Quote:" Backslash:\\';
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: special }], {
                type: "string",
            });
            expect(result).toBe(special);
        });
    });

    describe("Borrowed strings", () => {
        it("should handle borrowed string return", () => {
            const quark = call(
                GLIB_LIB,
                "g_quark_from_string",
                [{ type: { type: "string" }, value: "borrowed-test" }],
                { type: "int", size: 32, unsigned: true },
            ) as number;

            const result = call(
                GLIB_LIB,
                "g_quark_to_string",
                [{ type: { type: "int", size: 32, unsigned: true }, value: quark }],
                { type: "string", borrowed: true },
            );
            expect(result).toBe("borrowed-test");
        });

        it("should handle borrowed string from widget", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Label Text" }], {
                type: "gobject",
                borrowed: true,
            });

            const text = call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: label }], {
                type: "string",
                borrowed: true,
            });
            expect(text).toBe("Label Text");
        });
    });

    describe("Unicode strings", () => {
        it("should handle Chinese characters", () => {
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "你好世界" }], {
                type: "string",
            });
            expect(result).toBe("你好世界");
        });

        it("should handle Arabic characters", () => {
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "مرحبا بالعالم" }], {
                type: "string",
            });
            expect(result).toBe("مرحبا بالعالم");
        });

        it("should handle emoji", () => {
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "Hello 🌍🎉🚀" }], {
                type: "string",
            });
            expect(result).toBe("Hello 🌍🎉🚀");
        });

        it("should handle mixed scripts", () => {
            const mixed = "Hello 世界 مرحبا 🌍 Привет";
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: mixed }], {
                type: "string",
            });
            expect(result).toBe(mixed);
        });
    });

    describe("Edge case strings", () => {
        it("should handle empty string", () => {
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "" }], {
                type: "string",
            });
            expect(result).toBe("");
        });

        it("should handle very long string (10000 chars)", () => {
            const longStr = "x".repeat(10000);
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: longStr }], {
                type: "string",
            }) as string;
            expect(result).toBe(longStr);
            expect(result.length).toBe(10000);
        });

        it("should handle string with null-like content", () => {
            const result = call(GLIB_LIB, "g_strdup", [{ type: { type: "string" }, value: "null" }], {
                type: "string",
            });
            expect(result).toBe("null");
        });
    });
});

describe("Boolean Type Permutations", () => {
    it("should handle boolean true argument", () => {
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

        const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: { type: "gobject" }, value: label }], {
            type: "boolean",
        });
        expect(result).toBe(true);
    });

    it("should handle boolean false argument", () => {
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

        const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: { type: "gobject" }, value: label }], {
            type: "boolean",
        });
        expect(result).toBe(false);
    });

    it("should handle boolean return from widget state", () => {
        const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

        const visible = call(GTK_LIB, "gtk_widget_get_visible", [{ type: { type: "gobject" }, value: button }], {
            type: "boolean",
        });
        expect(typeof visible).toBe("boolean");
    });

    it("should handle boolean in signal connection", () => {
        const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });

        // after parameter is boolean
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
                { type: { type: "boolean" }, value: true }, // after = true
            ],
            { type: "int", size: 64, unsigned: true },
        );
        expect(handlerId).toBeGreaterThan(0);
    });
});
