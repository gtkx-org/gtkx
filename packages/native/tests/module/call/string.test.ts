import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    createButton,
    createLabel,
    forceGC,
    GOBJECT,
    GOBJECT_NONE,
    GTK_LIB,
    getRefCount,
    STRING,
    STRING_NONE,
    startMemoryMeasurement,
    UNDEFINED,
} from "../utils.js";

describe("call - string types", () => {
    describe("owned strings", () => {
        it("passes owned string as argument", () => {
            const label = createLabel("Initial");

            call(
                GTK_LIB,
                "gtk_label_set_text",
                [
                    { type: GOBJECT_NONE, value: label },
                    { type: STRING, value: "Updated" },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe("Updated");
        });

        it("creates widget with owned string", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Created with string" }], GOBJECT);

            const text = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(text).toBe("Created with string");
        });

        it("handles empty strings", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "" }], GOBJECT);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe("");
        });

        it("handles unicode strings", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Hello 世界 🎉" }], GOBJECT);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe("Hello 世界 🎉");
        });

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
                const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: testString }], GOBJECT);

                const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

                expect(result).toBe(testString);
            }
        });

        it("handles very long strings", () => {
            const longString = "a".repeat(10000);

            const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: longString }], GOBJECT);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe(longString);
            expect((result as string).length).toBe(10000);
        });

        it("handles button labels", () => {
            const button = call(GTK_LIB, "gtk_button_new_with_label", [{ type: STRING, value: "Click Me" }], GOBJECT);

            const label = call(GTK_LIB, "gtk_button_get_label", [{ type: GOBJECT_NONE, value: button }], STRING_NONE);

            expect(label).toBe("Click Me");
        });

        it("updates button label", () => {
            const button = createButton("Initial");

            call(
                GTK_LIB,
                "gtk_button_set_label",
                [
                    { type: GOBJECT_NONE, value: button },
                    { type: STRING, value: "Updated Label" },
                ],
                UNDEFINED,
            );

            const label = call(GTK_LIB, "gtk_button_get_label", [{ type: GOBJECT_NONE, value: button }], STRING_NONE);

            expect(label).toBe("Updated Label");
        });
    });

    describe("transfer none strings", () => {
        it("returns transfer none string from GTK", () => {
            const label = createLabel("Transfer None Test");

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe("Transfer None Test");
        });

        it("transfer none string remains valid during object lifetime", () => {
            const label = createLabel("Persistent");

            const text1 = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            const text2 = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(text1).toBe("Persistent");
            expect(text2).toBe("Persistent");
        });
    });

    describe("memory leaks", () => {
        it("does not leak owned strings passed as arguments", () => {
            const label = createLabel("Test");
            const labelRefCount = getRefCount(label);

            for (let i = 0; i < 1000; i++) {
                call(
                    GTK_LIB,
                    "gtk_label_set_text",
                    [
                        { type: GOBJECT_NONE, value: label },
                        { type: STRING, value: `String ${i}` },
                    ],
                    UNDEFINED,
                );
            }

            forceGC();

            expect(getRefCount(label)).toBe(labelRefCount);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe("String 999");
        });

        it("does not leak when creating many labels with strings", () => {
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 1000; i++) {
                createLabel(`Label ${i}`);
            }

            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
        });

        it("does not leak when setting many strings in loop", () => {
            const label = createLabel("Initial");
            const labelRefCount = getRefCount(label);
            const longString = "x".repeat(1000);
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 500; i++) {
                call(
                    GTK_LIB,
                    "gtk_label_set_text",
                    [
                        { type: GOBJECT_NONE, value: label },
                        { type: STRING, value: `${longString}_${i}` },
                    ],
                    UNDEFINED,
                );
            }

            expect(getRefCount(label)).toBe(labelRefCount);
            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toContain("_499");
        });
    });

    describe("edge cases", () => {
        it("handles emoji and complex unicode", () => {
            const complexUnicode = "🎉🎊🎁 Привет мир 你好世界 مرحبا بالعالم";

            const label = createLabel(complexUnicode);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe(complexUnicode);
        });

        it("handles RTL text", () => {
            const rtlText = "مرحبا بالعالم";

            const label = createLabel(rtlText);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe(rtlText);
        });

        it("handles combining characters", () => {
            const combining = "e\u0301";

            const label = createLabel(combining);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe(combining);
        });

        it("handles zero-width characters", () => {
            const zeroWidth = "a\u200Bb\u200Cc";

            const label = createLabel(zeroWidth);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe(zeroWidth);
        });

        it("handles surrogate pairs correctly", () => {
            const surrogatePair = "𝄞";

            const label = createLabel(surrogatePair);

            const result = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(result).toBe(surrogatePair);
        });

        it("handles pango markup strings", () => {
            const label = createLabel("");

            call(
                GTK_LIB,
                "gtk_label_set_markup",
                [
                    { type: GOBJECT_NONE, value: label },
                    { type: STRING, value: "<b>Bold</b> and <i>italic</i>" },
                ],
                UNDEFINED,
            );

            const text = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(text).toBe("Bold and italic");
        });
    });
});
