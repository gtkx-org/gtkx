import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import { BOOLEAN, createButton, createLabel, GOBJECT_BORROWED, GTK_LIB, UNDEFINED } from "../utils.js";

describe("call - boolean type", () => {
    it("passes true and returns true", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: true },
            ],
            UNDEFINED,
        );

        const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN);

        expect(result).toBe(true);
    });

    it("passes false and returns false", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: true },
            ],
            UNDEFINED,
        );

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: false },
            ],
            UNDEFINED,
        );

        const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN);

        expect(result).toBe(false);
    });

    it("toggles boolean state correctly", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: false },
            ],
            UNDEFINED,
        );

        expect(call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN)).toBe(
            false,
        );

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: true },
            ],
            UNDEFINED,
        );

        expect(call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN)).toBe(
            true,
        );

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: false },
            ],
            UNDEFINED,
        );

        expect(call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN)).toBe(
            false,
        );
    });

    it("handles boolean as argument and return simultaneously", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: true },
            ],
            UNDEFINED,
        );

        const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN);

        expect(result).toBe(true);
    });

    it("handles widget visibility", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_widget_set_visible",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: false },
            ],
            UNDEFINED,
        );

        const visible = call(GTK_LIB, "gtk_widget_get_visible", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN);

        expect(visible).toBe(false);
    });

    it("handles widget sensitivity", () => {
        const button = createButton("Test");

        call(
            GTK_LIB,
            "gtk_widget_set_sensitive",
            [
                { type: GOBJECT_BORROWED, value: button },
                { type: BOOLEAN, value: false },
            ],
            UNDEFINED,
        );

        const sensitive = call(
            GTK_LIB,
            "gtk_widget_get_sensitive",
            [{ type: GOBJECT_BORROWED, value: button }],
            BOOLEAN,
        );

        expect(sensitive).toBe(false);
    });

    it("handles button has_frame property", () => {
        const button = createButton("Test");

        call(
            GTK_LIB,
            "gtk_button_set_has_frame",
            [
                { type: GOBJECT_BORROWED, value: button },
                { type: BOOLEAN, value: false },
            ],
            UNDEFINED,
        );

        const hasFrame = call(
            GTK_LIB,
            "gtk_button_get_has_frame",
            [{ type: GOBJECT_BORROWED, value: button }],
            BOOLEAN,
        );

        expect(hasFrame).toBe(false);
    });

    it("handles label wrap property", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_label_set_wrap",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: true },
            ],
            UNDEFINED,
        );

        const wrap = call(GTK_LIB, "gtk_label_get_wrap", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN);

        expect(wrap).toBe(true);
    });

    it("handles label use_markup property", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_label_set_use_markup",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: true },
            ],
            UNDEFINED,
        );

        const useMarkup = call(
            GTK_LIB,
            "gtk_label_get_use_markup",
            [{ type: GOBJECT_BORROWED, value: label }],
            BOOLEAN,
        );

        expect(useMarkup).toBe(true);
    });

    describe("edge cases", () => {
        it("default boolean state is retrieved correctly", () => {
            const label = createLabel("Test");

            const selectable = call(
                GTK_LIB,
                "gtk_label_get_selectable",
                [{ type: GOBJECT_BORROWED, value: label }],
                BOOLEAN,
            );

            expect(selectable).toBe(false);
        });

        it("handles multiple boolean properties on same widget", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_label_set_selectable",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: BOOLEAN, value: true },
                ],
                UNDEFINED,
            );

            call(
                GTK_LIB,
                "gtk_label_set_wrap",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: BOOLEAN, value: true },
                ],
                UNDEFINED,
            );

            call(
                GTK_LIB,
                "gtk_label_set_use_markup",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: BOOLEAN, value: false },
                ],
                UNDEFINED,
            );

            expect(call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN)).toBe(
                true,
            );

            expect(call(GTK_LIB, "gtk_label_get_wrap", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN)).toBe(true);

            expect(call(GTK_LIB, "gtk_label_get_use_markup", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN)).toBe(
                false,
            );
        });
    });
});
