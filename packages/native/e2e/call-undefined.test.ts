import { describe, expect, it } from "vitest";
import {
    BOOLEAN,
    callArgs,
    createBox,
    createButton,
    createLabel,
    OBJECT_BORROWED,
    GTK_LIB,
    INT32,
    STRING,
    STRING_BORROWED,
    VOID,
} from "./helpers/utils.js";

describe("call - undefined type - basic void", () => {
    it("returns undefined for void functions", () => {
        const label = createLabel("Test");

        const result = callArgs(
            GTK_LIB,
            "gtk_label_set_text",
            [
                { type: OBJECT_BORROWED, value: label },
                { type: STRING, value: "Updated" },
            ],
            VOID,
        );

        expect(result).toBeUndefined();
    });
});

describe("call - undefined type - widget operations", () => {
    it("handles gtk_widget_hide", () => {
        const button = createButton("Test");

        const result = callArgs(GTK_LIB, "gtk_widget_hide", [{ type: OBJECT_BORROWED, value: button }], VOID);

        expect(result).toBeUndefined();
    });

    it("handles gtk_widget_set_sensitive", () => {
        const button = createButton("Test");

        const result = callArgs(
            GTK_LIB,
            "gtk_widget_set_sensitive",
            [
                { type: OBJECT_BORROWED, value: button },
                { type: BOOLEAN, value: false },
            ],
            VOID,
        );

        expect(result).toBeUndefined();
    });
});

describe("call - undefined type - box operations", () => {
    it("handles gtk_box_remove", () => {
        const box = createBox();
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_box_append",
            [
                { type: OBJECT_BORROWED, value: box },
                { type: OBJECT_BORROWED, value: label },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_box_remove",
            [
                { type: OBJECT_BORROWED, value: box },
                { type: OBJECT_BORROWED, value: label },
            ],
            VOID,
        );

        expect(result).toBeUndefined();
    });

    it("handles gtk_box_set_spacing", () => {
        const box = createBox();

        const result = callArgs(
            GTK_LIB,
            "gtk_box_set_spacing",
            [
                { type: OBJECT_BORROWED, value: box },
                { type: INT32, value: 10 },
            ],
            VOID,
        );

        expect(result).toBeUndefined();
    });
});

describe("call - undefined type - edge cases identity", () => {
    it("return value is exactly undefined, not null", () => {
        const label = createLabel("Test");

        const result = callArgs(
            GTK_LIB,
            "gtk_label_set_text",
            [
                { type: OBJECT_BORROWED, value: label },
                { type: STRING, value: "Test" },
            ],
            VOID,
        );

        expect(result).toBeUndefined();
        expect(result).not.toBeNull();
        expect(result === undefined).toBe(true);
        expect(result === null).toBe(false);
    });
});

describe("call - undefined type - edge cases state change", () => {
    it("void return with state change still modifies state", () => {
        const label = createLabel("Initial");

        const result = callArgs(
            GTK_LIB,
            "gtk_label_set_text",
            [
                { type: OBJECT_BORROWED, value: label },
                { type: STRING, value: "Modified" },
            ],
            VOID,
        );

        expect(result).toBeUndefined();

        const text = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: OBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(text).toBe("Modified");
    });
});
