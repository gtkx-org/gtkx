import { describe, expect, it } from "vitest";
import { call } from "../index.js";
import { GLIB_LIB, GOBJECT_LIB, GTK_LIB, setup } from "./integration.js";

setup();

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

    it("should handle callbacks with integer and float arguments", () => {
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

describe("Callback Trampoline Types", () => {
    it("should handle destroy callback for cleanup", () => {
        const button = call(GTK_LIB, "gtk_button_new", [], { type: "gobject", borrowed: true });
        call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: button }], {
            type: "gobject",
            borrowed: true,
        });

        call(
            GOBJECT_LIB,
            "g_object_set_data_full",
            [
                { type: { type: "gobject" }, value: button },
                { type: { type: "string" }, value: "test-key" },
                { type: { type: "gobject" }, value: button },
                {
                    type: { type: "callback", trampoline: "destroy" },
                    value: () => {},
                },
            ],
            { type: "undefined" },
        );

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

    it("should handle sourceFunc callback with idle_add", () => {
        const sourceId = call(
            GLIB_LIB,
            "g_idle_add",
            [
                {
                    type: { type: "callback", trampoline: "sourceFunc" },
                    value: () => false,
                },
            ],
            { type: "int", size: 32, unsigned: true },
        ) as number;

        expect(sourceId).toBeGreaterThan(0);

        call(GLIB_LIB, "g_source_remove", [{ type: { type: "int", size: 32, unsigned: true }, value: sourceId }], {
            type: "boolean",
        });
    });

    it("should handle sourceFunc callback with timeout_add", () => {
        const sourceId = call(
            GLIB_LIB,
            "g_timeout_add",
            [
                { type: { type: "int", size: 32, unsigned: true }, value: 60000 },
                {
                    type: { type: "callback", trampoline: "sourceFunc" },
                    value: () => false,
                },
            ],
            { type: "int", size: 32, unsigned: true },
        ) as number;

        expect(sourceId).toBeGreaterThan(0);

        call(GLIB_LIB, "g_source_remove", [{ type: { type: "int", size: 32, unsigned: true }, value: sourceId }], {
            type: "boolean",
        });
    });

    it("should handle drawFunc callback for drawing area", () => {
        const drawingArea = call(GTK_LIB, "gtk_drawing_area_new", [], { type: "gobject", borrowed: true });
        expect(drawingArea).not.toBeNull();

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
                            { type: "gobject", borrowed: true },
                            { type: "boxed", innerType: "cairo_t", lib: "libcairo.so.2", borrowed: true },
                            { type: "int", size: 32 },
                            { type: "int", size: 32 },
                        ],
                    },
                    value: (_area: unknown, _cr: unknown, _width: unknown, _height: unknown) => {},
                },
            ],
            { type: "undefined" },
        );

        const visible = call(GTK_LIB, "gtk_widget_get_visible", [{ type: { type: "gobject" }, value: drawingArea }], {
            type: "boolean",
        });
        expect(typeof visible).toBe("boolean");
    });
});
