import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    BOOLEAN,
    createBox,
    createButton,
    createLabel,
    GOBJECT_BORROWED,
    GTK_LIB,
    INT32,
    STRING,
    STRING_BORROWED,
    UNDEFINED,
} from "../utils.js";

describe("call - undefined type", () => {
    it("returns undefined for void functions", () => {
        const label = createLabel("Test");

        const result = call(
            GTK_LIB,
            "gtk_label_set_text",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING, value: "Updated" },
            ],
            UNDEFINED,
        );

        expect(result).toBeUndefined();
    });

    it("handles void function with no args", () => {
        const button = createButton("Test");

        const result = call(GTK_LIB, "gtk_widget_show", [{ type: GOBJECT_BORROWED, value: button }], UNDEFINED);

        expect(result).toBeUndefined();
    });

    it("handles void function with multiple args", () => {
        const box = createBox();
        const label = createLabel("Test");

        const result = call(
            GTK_LIB,
            "gtk_box_append",
            [
                { type: GOBJECT_BORROWED, value: box },
                { type: GOBJECT_BORROWED, value: label },
            ],
            UNDEFINED,
        );

        expect(result).toBeUndefined();
    });

    it("handles gtk_widget_hide", () => {
        const button = createButton("Test");

        const result = call(GTK_LIB, "gtk_widget_hide", [{ type: GOBJECT_BORROWED, value: button }], UNDEFINED);

        expect(result).toBeUndefined();
    });

    it("handles gtk_widget_set_sensitive", () => {
        const button = createButton("Test");

        const result = call(
            GTK_LIB,
            "gtk_widget_set_sensitive",
            [
                { type: GOBJECT_BORROWED, value: button },
                { type: BOOLEAN, value: false },
            ],
            UNDEFINED,
        );

        expect(result).toBeUndefined();
    });

    it("handles gtk_box_remove", () => {
        const box = createBox();
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_box_append",
            [
                { type: GOBJECT_BORROWED, value: box },
                { type: GOBJECT_BORROWED, value: label },
            ],
            UNDEFINED,
        );

        const result = call(
            GTK_LIB,
            "gtk_box_remove",
            [
                { type: GOBJECT_BORROWED, value: box },
                { type: GOBJECT_BORROWED, value: label },
            ],
            UNDEFINED,
        );

        expect(result).toBeUndefined();
    });

    it("handles gtk_box_set_spacing", () => {
        const box = createBox();

        const result = call(
            GTK_LIB,
            "gtk_box_set_spacing",
            [
                { type: GOBJECT_BORROWED, value: box },
                { type: INT32, value: 10 },
            ],
            UNDEFINED,
        );

        expect(result).toBeUndefined();
    });

    describe("edge cases", () => {
        it("return value is exactly undefined, not null", () => {
            const label = createLabel("Test");

            const result = call(
                GTK_LIB,
                "gtk_label_set_text",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: "Test" },
                ],
                UNDEFINED,
            );

            expect(result).toBeUndefined();
            expect(result).not.toBeNull();
            expect(result === undefined).toBe(true);
            expect(result === null).toBe(false);
        });

        it("consecutive void calls return undefined", () => {
            const label = createLabel("Test");

            const result1 = call(
                GTK_LIB,
                "gtk_label_set_text",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: "First" },
                ],
                UNDEFINED,
            );

            const result2 = call(
                GTK_LIB,
                "gtk_label_set_text",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: "Second" },
                ],
                UNDEFINED,
            );

            expect(result1).toBeUndefined();
            expect(result2).toBeUndefined();
        });

        it("void return with state change still modifies state", () => {
            const label = createLabel("Initial");

            const result = call(
                GTK_LIB,
                "gtk_label_set_text",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: "Modified" },
                ],
                UNDEFINED,
            );

            expect(result).toBeUndefined();

            const text = call(
                GTK_LIB,
                "gtk_label_get_text",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_BORROWED,
            );

            expect(text).toBe("Modified");
        });
    });
});
