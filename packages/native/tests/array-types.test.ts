import { describe, expect, it } from "vitest";
import { call } from "../index.js";
import { GDK_LIB, GIO_LIB, GTK_LIB, setup } from "./integration.js";

setup();

describe("GList/GSList Types", () => {
    it("should handle GList return type with GObject elements", () => {
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

    it("should handle GSList return type with GObject elements", () => {
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
