import { describe, expect, it } from "vitest";
import {
    callArgs,
    createButton,
    createLabel,
    forceGC,
    GOBJECT,
    GOBJECT_BORROWED,
    GTK_LIB,
    getRefCount,
    STRING,
    STRING_BORROWED,
    startMemoryMeasurement,
    VOID,
} from "./helpers/utils.js";

describe("call - string types - owned basic", () => {
    it("passes owned string as argument", () => {
        const label = createLabel("Initial");

        callArgs(
            GTK_LIB,
            "gtk_label_set_text",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING, value: "Updated" },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(result).toBe("Updated");
    });

    it("creates widget with owned string", () => {
        const label = callArgs(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Created with string" }], GOBJECT);

        const text = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(text).toBe("Created with string");
    });
});

describe("call - string types - owned empty and unicode", () => {
    it("handles empty strings", () => {
        const label = callArgs(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "" }], GOBJECT);

        const result = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(result).toBe("");
    });
});

describe("call - string types - owned special characters", () => {
    it("handles strings with special characters", () => {
        const testStrings = [
            "Line1\nLine2",
            "Tab\there",
            'Quote: "hello"',
            "Single: 'hello'",
            "Backslash: \\path\\to\\file",
            "<html>&amp;</html>",
        ];

        for (const testString of testStrings) {
            const label = callArgs(GTK_LIB, "gtk_label_new", [{ type: STRING, value: testString }], GOBJECT);

            const result = callArgs(
                GTK_LIB,
                "gtk_label_get_text",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_BORROWED,
            );

            expect(result).toBe(testString);
        }
    });

    it("handles very long strings", () => {
        const longString = "a".repeat(10000);

        const label = callArgs(GTK_LIB, "gtk_label_new", [{ type: STRING, value: longString }], GOBJECT);

        const result = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(result).toBe(longString);
        expect((result as string).length).toBe(10000);
    });
});

describe("call - string types - owned button labels", () => {
    it("handles button labels", () => {
        const button = callArgs(GTK_LIB, "gtk_button_new_with_label", [{ type: STRING, value: "Click Me" }], GOBJECT);

        const label = callArgs(
            GTK_LIB,
            "gtk_button_get_label",
            [{ type: GOBJECT_BORROWED, value: button }],
            STRING_BORROWED,
        );

        expect(label).toBe("Click Me");
    });

    it("updates button label", () => {
        const button = createButton("Initial");

        callArgs(
            GTK_LIB,
            "gtk_button_set_label",
            [
                { type: GOBJECT_BORROWED, value: button },
                { type: STRING, value: "Updated Label" },
            ],
            VOID,
        );

        const label = callArgs(
            GTK_LIB,
            "gtk_button_get_label",
            [{ type: GOBJECT_BORROWED, value: button }],
            STRING_BORROWED,
        );

        expect(label).toBe("Updated Label");
    });
});

describe("call - string types - transfer none", () => {
    it("transfer none string remains valid during object lifetime", () => {
        const label = createLabel("Persistent");

        const text1 = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        const text2 = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(text1).toBe("Persistent");
        expect(text2).toBe("Persistent");
    });
});

describe("call - string types - memory leaks args", () => {
    it("does not leak owned strings passed as arguments", () => {
        const label = createLabel("Test");
        const labelRefCount = getRefCount(label);

        for (let i = 0; i < 1000; i++) {
            callArgs(
                GTK_LIB,
                "gtk_label_set_text",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: `String ${i}` },
                ],
                VOID,
            );
        }

        forceGC();

        expect(getRefCount(label)).toBe(labelRefCount);

        const result = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(result).toBe("String 999");
    });
});

describe("call - string types - memory leaks set loop", () => {
    it("does not leak when setting many strings in loop", () => {
        const label = createLabel("Initial");
        const labelRefCount = getRefCount(label);
        const longString = "x".repeat(1000);
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 500; i++) {
            callArgs(
                GTK_LIB,
                "gtk_label_set_text",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: `${longString}_${i}` },
                ],
                VOID,
            );
        }

        expect(getRefCount(label)).toBe(labelRefCount);
        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);

        const result = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(result).toContain("_499");
    });
});

describe("call - string types - edge cases emoji unicode", () => {
    it("handles emoji and complex unicode", () => {
        const complexUnicode = "🎉🎊🎁 Привет мир 你好世界 مرحبا بالعالم";

        const label = createLabel(complexUnicode);

        const result = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(result).toBe(complexUnicode);
    });
});

describe("call - string types - edge cases markup", () => {
    it("handles pango markup strings", () => {
        const label = createLabel("");

        callArgs(
            GTK_LIB,
            "gtk_label_set_markup",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING, value: "<b>Bold</b> and <i>italic</i>" },
            ],
            VOID,
        );

        const text = callArgs(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_BORROWED,
        );

        expect(text).toBe("Bold and italic");
    });
});
