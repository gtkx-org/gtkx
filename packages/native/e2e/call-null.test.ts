import { describe, expect, it } from "vitest";
import {
    boxAppend,
    callArgs,
    createBox,
    createLabel,
    OBJECT,
    OBJECT_BORROWED,
    GTK_LIB,
    getFirstChild,
    getNextSibling,
    getParent,
    measureWidgetAllNull,
    POINTER,
    STRING_BORROWED,
} from "./helpers/utils.js";

describe("call - null pointer arguments - basic", () => {
    it("passes null pointer as optional argument", () => {
        const label = callArgs(GTK_LIB, "gtk_label_new", [{ type: POINTER, value: 0 }], OBJECT);

        const text = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: OBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(text).toBe("");
    });

    it("passes null for unused out-parameters", () => {
        const label = createLabel("Test");

        expect(measureWidgetAllNull(label)).toBeUndefined();
    });
});

describe("call - null pointer arguments - return values", () => {
    it("returns null for missing sibling", () => {
        const box = createBox();
        const label = createLabel("Only Child");

        boxAppend(box, label);

        expect(getNextSibling(label)).toBeNull();
    });

    it("returns null for empty container first child", () => {
        const box = createBox();

        expect(getFirstChild(box)).toBeNull();
    });
});

describe("call - null pointer arguments - edge cases", () => {
    it("returns null for absent optional GObject return", () => {
        const label = createLabel("Test");

        const parent = getParent(label);

        expect(parent).toBeNull();
        expect(parent).not.toBeUndefined();
    });

    it("handles null GObject vs actual GObject", () => {
        const box = createBox();
        const label = createLabel("Test");

        expect(getFirstChild(box)).toBeNull();

        boxAppend(box, label);

        expect(getFirstChild(box)).not.toBeNull();
    });
});
