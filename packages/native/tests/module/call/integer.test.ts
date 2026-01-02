import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    createBox,
    createButton,
    createGrid,
    createLabel,
    GOBJECT,
    GOBJECT_BORROWED,
    GOBJECT_LIB,
    GTK_LIB,
    INT8,
    INT16,
    INT32,
    INT64,
    NULL,
    STRING,
    UINT8,
    UINT16,
    UINT32,
    UINT64,
    UNDEFINED,
} from "../utils.js";

describe("call - integer types", () => {
    describe("8-bit signed", () => {
        it("handles signed 8-bit as part of boolean-like values", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_selectable",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT8, value: 1 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], INT8);

            expect(result).toBe(1);
        });

        it("handles zero value", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_selectable",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT8, value: 0 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], INT8);

            expect(result).toBe(0);
        });
    });

    describe("8-bit unsigned", () => {
        it("handles unsigned 8-bit values", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_selectable",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: UINT8, value: 1 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], UINT8);

            expect(result).toBe(1);
        });
    });

    describe("16-bit signed", () => {
        it("passes and returns 16-bit signed integers", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT16, value: 100 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_label_get_max_width_chars",
                [{ type: GOBJECT_BORROWED, value: label }],
                INT16,
            );

            expect(result).toBe(100);
        });

        it("handles negative 16-bit values", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT16, value: -1 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_label_get_max_width_chars",
                [{ type: GOBJECT_BORROWED, value: label }],
                INT16,
            );

            expect(result).toBe(-1);
        });
    });

    describe("16-bit unsigned", () => {
        it("passes and returns 16-bit unsigned integers", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: UINT16, value: 500 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_label_get_max_width_chars",
                [{ type: GOBJECT_BORROWED, value: label }],
                UINT16,
            );

            expect(result).toBe(500);
        });
    });

    describe("32-bit signed", () => {
        it("passes and returns 32-bit signed integers", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 42 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_label_get_max_width_chars",
                [{ type: GOBJECT_BORROWED, value: label }],
                INT32,
            );

            expect(result).toBe(42);
        });

        it("handles negative 32-bit values", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: -1 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_label_get_max_width_chars",
                [{ type: GOBJECT_BORROWED, value: label }],
                INT32,
            );

            expect(result).toBe(-1);
        });

        it("handles zero", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_label_get_max_width_chars",
                [{ type: GOBJECT_BORROWED, value: label }],
                INT32,
            );

            expect(result).toBe(0);
        });

        it("handles large positive values", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 100000 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_label_get_max_width_chars",
                [{ type: GOBJECT_BORROWED, value: label }],
                INT32,
            );

            expect(result).toBe(100000);
        });

        it("handles enum values (GtkOrientation)", () => {
            const boxHorizontal = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: INT32, value: 0 },
                    { type: INT32, value: 0 },
                ],
                GOBJECT,
            );

            const boxVertical = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: INT32, value: 1 },
                    { type: INT32, value: 0 },
                ],
                GOBJECT,
            );

            const orientationH = call(
                GTK_LIB,
                "gtk_orientable_get_orientation",
                [{ type: GOBJECT_BORROWED, value: boxHorizontal }],
                INT32,
            );

            const orientationV = call(
                GTK_LIB,
                "gtk_orientable_get_orientation",
                [{ type: GOBJECT_BORROWED, value: boxVertical }],
                INT32,
            );

            expect(orientationH).toBe(0);
            expect(orientationV).toBe(1);
        });
    });

    describe("32-bit unsigned", () => {
        it("passes and returns 32-bit unsigned integers", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: UINT32, value: 200 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_label_get_max_width_chars",
                [{ type: GOBJECT_BORROWED, value: label }],
                UINT32,
            );

            expect(result).toBe(200);
        });

        it("handles flags values (GApplicationFlags)", () => {
            const box = createBox(0, 5);

            call(
                GTK_LIB,
                "gtk_box_set_spacing",
                [
                    { type: GOBJECT_BORROWED, value: box },
                    { type: UINT32, value: 10 },
                ],
                UNDEFINED,
            );

            const spacing = call(GTK_LIB, "gtk_box_get_spacing", [{ type: GOBJECT_BORROWED, value: box }], UINT32);

            expect(spacing).toBe(10);
        });
    });

    describe("64-bit signed", () => {
        it("passes and returns 64-bit signed integers", () => {
            const button = createButton("Test");

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_data",
                [
                    { type: GOBJECT_BORROWED, value: button },
                    { type: STRING, value: "clicked" },
                    { type: { type: "callback", trampoline: "closure" }, value: () => {} },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: INT32, value: 0 },
                ],
                INT64,
            );

            expect(typeof handlerId).toBe("number");
            expect(handlerId).toBeGreaterThan(0);
        });
    });

    describe("64-bit unsigned", () => {
        it("passes and returns 64-bit unsigned integers", () => {
            const button = createButton("Test");

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_data",
                [
                    { type: GOBJECT_BORROWED, value: button },
                    { type: STRING, value: "clicked" },
                    { type: { type: "callback", trampoline: "closure" }, value: () => {} },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: INT32, value: 0 },
                ],
                UINT64,
            );

            expect(typeof handlerId).toBe("number");
            expect(handlerId).toBeGreaterThan(0);
        });

        it("handles signal handler disconnection", () => {
            const button = createButton("Test");

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_data",
                [
                    { type: GOBJECT_BORROWED, value: button },
                    { type: STRING, value: "clicked" },
                    { type: { type: "callback", trampoline: "closure" }, value: () => {} },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: INT32, value: 0 },
                ],
                UINT64,
            );

            call(
                GOBJECT_LIB,
                "g_signal_handler_disconnect",
                [
                    { type: GOBJECT_BORROWED, value: button },
                    { type: UINT64, value: handlerId },
                ],
                UNDEFINED,
            );

            const isConnected = call(
                GOBJECT_LIB,
                "g_signal_handler_is_connected",
                [
                    { type: GOBJECT_BORROWED, value: button },
                    { type: UINT64, value: handlerId },
                ],
                INT32,
            );

            expect(isConnected).toBe(0);
        });
    });

    describe("edge cases", () => {
        it("handles integer as argument and return type simultaneously", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 50 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_label_get_max_width_chars",
                [{ type: GOBJECT_BORROWED, value: label }],
                INT32,
            );

            expect(result).toBe(50);
        });

        it("handles multiple integer arguments of different sizes", () => {
            const grid = createGrid();
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_grid_attach",
                [
                    { type: GOBJECT_BORROWED, value: grid },
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: 0 },
                    { type: INT32, value: 1 },
                    { type: INT32, value: 1 },
                ],
                UNDEFINED,
            );

            const firstChild = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_BORROWED, value: grid }],
                GOBJECT_BORROWED,
            );

            expect(firstChild).toBeDefined();
        });

        it("handles spacing values in containers", () => {
            const box = createBox(0, 0);

            call(
                GTK_LIB,
                "gtk_box_set_spacing",
                [
                    { type: GOBJECT_BORROWED, value: box },
                    { type: INT32, value: 15 },
                ],
                UNDEFINED,
            );

            const spacing = call(GTK_LIB, "gtk_box_get_spacing", [{ type: GOBJECT_BORROWED, value: box }], INT32);

            expect(spacing).toBe(15);
        });
    });
});
