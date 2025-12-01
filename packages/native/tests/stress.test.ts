import { describe, expect, it } from "vitest";
import { alloc, call, write } from "../index.js";
import { GDK_LIB, GLIB_LIB, GOBJECT_LIB, GTK_LIB, setup } from "./integration.js";

setup();

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
    it("should not leak memory with repeated object creation", () => {
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
