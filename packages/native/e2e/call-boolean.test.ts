import { describe, expect, it } from "vitest";
import type { Value } from "../binding.js";
import { BOOLEAN, callArgs, createButton, createLabel, OBJECT_BORROWED, GTK_LIB, VOID } from "./helpers/utils.js";

function setLabelSelectable(label: Value, value: boolean): void {
    callArgs(
        GTK_LIB,
        "gtk_label_set_selectable",
        [
            { type: OBJECT_BORROWED, value: label },
            { type: BOOLEAN, value },
        ],
        VOID,
    );
}

function getLabelSelectable(label: Value): boolean {
    return callArgs(
        GTK_LIB,
        "gtk_label_get_selectable",
        [{ type: OBJECT_BORROWED, value: label }],
        BOOLEAN,
    ) as boolean;
}

describe("call - boolean type - label selectable", () => {
    it("passes true and returns true", () => {
        const label = createLabel("Test");

        setLabelSelectable(label, true);

        expect(getLabelSelectable(label)).toBe(true);
    });

    it("passes false and returns false", () => {
        const label = createLabel("Test");

        setLabelSelectable(label, true);
        setLabelSelectable(label, false);

        expect(getLabelSelectable(label)).toBe(false);
    });
});

describe("call - boolean type - label selectable toggling", () => {
    it("toggles boolean state correctly", () => {
        const label = createLabel("Test");

        setLabelSelectable(label, false);
        expect(getLabelSelectable(label)).toBe(false);

        setLabelSelectable(label, true);
        expect(getLabelSelectable(label)).toBe(true);

        setLabelSelectable(label, false);
        expect(getLabelSelectable(label)).toBe(false);
    });
});

describe("call - boolean type - widget properties", () => {
    it("handles widget visibility", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_visible",
            [
                { type: OBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: false },
            ],
            VOID,
        );

        const visible = callArgs(
            GTK_LIB,
            "gtk_widget_get_visible",
            [{ type: OBJECT_BORROWED, value: label }],
            BOOLEAN,
        );

        expect(visible).toBe(false);
    });

    it("handles widget sensitivity", () => {
        const button = createButton("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_sensitive",
            [
                { type: OBJECT_BORROWED, value: button },
                { type: BOOLEAN, value: false },
            ],
            VOID,
        );

        const sensitive = callArgs(
            GTK_LIB,
            "gtk_widget_get_sensitive",
            [{ type: OBJECT_BORROWED, value: button }],
            BOOLEAN,
        );

        expect(sensitive).toBe(false);
    });
});

describe("call - boolean type - widget styling", () => {
    it("handles button has_frame property", () => {
        const button = createButton("Test");

        callArgs(
            GTK_LIB,
            "gtk_button_set_has_frame",
            [
                { type: OBJECT_BORROWED, value: button },
                { type: BOOLEAN, value: false },
            ],
            VOID,
        );

        const hasFrame = callArgs(
            GTK_LIB,
            "gtk_button_get_has_frame",
            [{ type: OBJECT_BORROWED, value: button }],
            BOOLEAN,
        );

        expect(hasFrame).toBe(false);
    });

    it("handles label wrap property", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_label_set_wrap",
            [
                { type: OBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: true },
            ],
            VOID,
        );

        const wrap = callArgs(GTK_LIB, "gtk_label_get_wrap", [{ type: OBJECT_BORROWED, value: label }], BOOLEAN);

        expect(wrap).toBe(true);
    });
});

describe("call - boolean type - label use_markup", () => {
    it("handles label use_markup property", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_label_set_use_markup",
            [
                { type: OBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: true },
            ],
            VOID,
        );

        const useMarkup = callArgs(
            GTK_LIB,
            "gtk_label_get_use_markup",
            [{ type: OBJECT_BORROWED, value: label }],
            BOOLEAN,
        );

        expect(useMarkup).toBe(true);
    });
});

describe("call - boolean type - edge cases", () => {
    it("default boolean state is retrieved correctly", () => {
        const label = createLabel("Test");

        expect(getLabelSelectable(label)).toBe(false);
    });

    it("handles multiple boolean properties on same widget", () => {
        const label = createLabel("Test");

        setLabelSelectable(label, true);

        callArgs(
            GTK_LIB,
            "gtk_label_set_wrap",
            [
                { type: OBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: true },
            ],
            VOID,
        );

        callArgs(
            GTK_LIB,
            "gtk_label_set_use_markup",
            [
                { type: OBJECT_BORROWED, value: label },
                { type: BOOLEAN, value: false },
            ],
            VOID,
        );

        expect(getLabelSelectable(label)).toBe(true);
        expect(callArgs(GTK_LIB, "gtk_label_get_wrap", [{ type: OBJECT_BORROWED, value: label }], BOOLEAN)).toBe(true);
        expect(callArgs(GTK_LIB, "gtk_label_get_use_markup", [{ type: OBJECT_BORROWED, value: label }], BOOLEAN)).toBe(
            false,
        );
    });
});
