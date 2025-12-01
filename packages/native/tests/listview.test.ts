import { describe, expect, it } from "vitest";
import { call } from "../index.js";
import { GIO_LIB, GLIB_LIB, GOBJECT_LIB, GTK_LIB, setup } from "./integration.js";

setup();

describe("ListView Integration", () => {
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

    it("should handle ListView with many items", () => {
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
