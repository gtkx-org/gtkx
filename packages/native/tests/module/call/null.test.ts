import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    createBox,
    createLabel,
    createRef,
    GOBJECT,
    GOBJECT_BORROWED,
    GTK_LIB,
    INT32,
    NULL,
    STRING_BORROWED,
    UNDEFINED,
} from "../utils.js";

describe("call - null type", () => {
    it("passes null as optional argument", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: NULL, value: null }], GOBJECT);

        const text = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label }], STRING_BORROWED);

        expect(text).toBe("");
    });

    it("passes null for unused out-parameters", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_widget_measure",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: INT32, value: 0 },
                { type: INT32, value: -1 },
                { type: NULL, value: null },
                { type: NULL, value: null },
                { type: NULL, value: null },
                { type: NULL, value: null },
            ],
            UNDEFINED,
        );
    });

    it("returns null for absent optional return", () => {
        const label = createLabel("Orphan");

        const parent = call(
            GTK_LIB,
            "gtk_widget_get_parent",
            [{ type: GOBJECT_BORROWED, value: label }],
            GOBJECT_BORROWED,
        );

        expect(parent).toBeNull();
    });

    it("returns null for missing sibling", () => {
        const box = createBox();
        const label = createLabel("Only Child");

        call(
            GTK_LIB,
            "gtk_box_append",
            [
                { type: GOBJECT_BORROWED, value: box },
                { type: GOBJECT_BORROWED, value: label },
            ],
            UNDEFINED,
        );

        const nextSibling = call(
            GTK_LIB,
            "gtk_widget_get_next_sibling",
            [{ type: GOBJECT_BORROWED, value: label }],
            GOBJECT_BORROWED,
        );

        expect(nextSibling).toBeNull();
    });

    it("returns null for empty container first child", () => {
        const box = createBox();

        const firstChild = call(
            GTK_LIB,
            "gtk_widget_get_first_child",
            [{ type: GOBJECT_BORROWED, value: box }],
            GOBJECT_BORROWED,
        );

        expect(firstChild).toBeNull();
    });

    it("handles null in callback user_data", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_widget_measure",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: INT32, value: 0 },
                { type: INT32, value: -1 },
                { type: NULL, value: null },
                { type: NULL, value: null },
                { type: NULL, value: null },
                { type: NULL, value: null },
            ],
            UNDEFINED,
        );
    });

    describe("edge cases", () => {
        it("distinguishes null from undefined in return", () => {
            const label = createLabel("Test");

            const parent = call(
                GTK_LIB,
                "gtk_widget_get_parent",
                [{ type: GOBJECT_BORROWED, value: label }],
                GOBJECT_BORROWED,
            );

            expect(parent).toBeNull();
            expect(parent).not.toBeUndefined();
        });

        it("handles null GObject vs actual GObject", () => {
            const box = createBox();
            const label = createLabel("Test");

            let child = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_BORROWED, value: box }],
                GOBJECT_BORROWED,
            );
            expect(child).toBeNull();

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_BORROWED, value: box },
                    { type: GOBJECT_BORROWED, value: label },
                ],
                UNDEFINED,
            );

            child = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_BORROWED, value: box }],
                GOBJECT_BORROWED,
            );
            expect(child).not.toBeNull();
        });

        it("handles null in mixed position arguments", () => {
            const label = createLabel("Test");
            const minRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: minRef },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(typeof minRef.value).toBe("number");
        });

        it("handles consecutive null arguments", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );
        });
    });
});
