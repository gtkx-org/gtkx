import { describe, expect, it } from "vitest";
import { call } from "../index.js";
import { GDK_LIB, GIO_LIB, GLIB_LIB, GTK_LIB, setup } from "./utils.js";

setup();

describe("GList/GSList Types - Borrowed", () => {
    it("should handle borrowed GList return type with GObject elements", () => {
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

    it("should handle borrowed GSList return type with GObject elements", () => {
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
});

describe("GList/GSList Types - Owned", () => {
    it("should handle owned GList return type (list freed after reading)", () => {
        const display = call(GDK_LIB, "gdk_display_get_default", [], {
            type: "gobject",
            borrowed: true,
        });
        expect(display).not.toBeNull();

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

    it("should handle owned GSList with g_slist_copy (list is owned, items borrowed)", () => {
        const displayManager = call(GDK_LIB, "gdk_display_manager_get", [], {
            type: "gobject",
            borrowed: true,
        });

        const displays = call(
            GDK_LIB,
            "gdk_display_manager_list_displays",
            [{ type: { type: "gobject" }, value: displayManager }],
            { type: "array", listType: "gslist", itemType: { type: "gobject", borrowed: true }, borrowed: false },
        ) as unknown[];

        expect(Array.isArray(displays)).toBe(true);
        expect(displays.length).toBeGreaterThanOrEqual(1);
    });
});

describe("GList/GSList Types - General", () => {
    it("should handle empty GListStore", () => {
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

        const count = call(GIO_LIB, "g_list_model_get_n_items", [{ type: { type: "gobject" }, value: store }], {
            type: "int",
            size: 32,
            unsigned: true,
        });
        expect(count).toBe(0);
    });

    it("should iterate GList elements and verify data", () => {
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
            const pointer = call(GDK_LIB, "gdk_seat_get_pointer", [{ type: { type: "gobject" }, value: seat }], {
                type: "gobject",
                borrowed: true,
            });
            expect(pointer).not.toBeNull();
        }
    });

    it("should handle list with many elements", () => {
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
    });
});

describe("Array Input Arguments", () => {
    it("should handle null-terminated string array input with g_strjoinv", () => {
        const result = call(
            GLIB_LIB,
            "g_strjoinv",
            [
                { type: { type: "string" }, value: ", " },
                {
                    type: { type: "array", itemType: { type: "string" } },
                    value: ["hello", "world", "test"],
                },
            ],
            { type: "string" },
        );
        expect(result).toBe("hello, world, test");
    });

    it("should handle empty string array input", () => {
        const result = call(
            GLIB_LIB,
            "g_strjoinv",
            [
                { type: { type: "string" }, value: "-" },
                {
                    type: { type: "array", itemType: { type: "string" } },
                    value: [],
                },
            ],
            { type: "string" },
        );
        expect(result).toBe("");
    });

    it("should handle single element string array", () => {
        const result = call(
            GLIB_LIB,
            "g_strjoinv",
            [
                { type: { type: "string" }, value: "," },
                {
                    type: { type: "array", itemType: { type: "string" } },
                    value: ["only-one"],
                },
            ],
            { type: "string" },
        );
        expect(result).toBe("only-one");
    });

    it("should handle string array with unicode", () => {
        const result = call(
            GLIB_LIB,
            "g_strjoinv",
            [
                { type: { type: "string" }, value: " | " },
                {
                    type: { type: "array", itemType: { type: "string" } },
                    value: ["Hello", "世界", "🌍"],
                },
            ],
            { type: "string" },
        );
        expect(result).toBe("Hello | 世界 | 🌍");
    });

    it("should handle string array with empty strings", () => {
        const result = call(
            GLIB_LIB,
            "g_strjoinv",
            [
                { type: { type: "string" }, value: "," },
                {
                    type: { type: "array", itemType: { type: "string" } },
                    value: ["a", "", "b", "", "c"],
                },
            ],
            { type: "string" },
        );
        expect(result).toBe("a,,b,,c");
    });

    it("should handle gtk_string_list_new with string array", () => {
        const stringList = call(
            GTK_LIB,
            "gtk_string_list_new",
            [
                {
                    type: { type: "array", itemType: { type: "string" } },
                    value: ["Item 1", "Item 2", "Item 3"],
                },
            ],
            { type: "gobject", borrowed: true },
        );
        expect(stringList).not.toBeNull();

        const count = call(GIO_LIB, "g_list_model_get_n_items", [{ type: { type: "gobject" }, value: stringList }], {
            type: "int",
            size: 32,
            unsigned: true,
        });
        expect(count).toBe(3);
    });

    it("should handle gtk_string_list_new with empty array", () => {
        const stringList = call(
            GTK_LIB,
            "gtk_string_list_new",
            [
                {
                    type: { type: "array", itemType: { type: "string" } },
                    value: [],
                },
            ],
            { type: "gobject", borrowed: true },
        );
        expect(stringList).not.toBeNull();

        const count = call(GIO_LIB, "g_list_model_get_n_items", [{ type: { type: "gobject" }, value: stringList }], {
            type: "int",
            size: 32,
            unsigned: true,
        });
        expect(count).toBe(0);
    });

    it("should handle many strings in array", () => {
        const strings = Array.from({ length: 100 }, (_, i) => `String ${i}`);
        const result = call(
            GLIB_LIB,
            "g_strjoinv",
            [
                { type: { type: "string" }, value: "," },
                {
                    type: { type: "array", itemType: { type: "string" } },
                    value: strings,
                },
            ],
            { type: "string" },
        );
        expect(result).toBe(strings.join(","));
    });
});
