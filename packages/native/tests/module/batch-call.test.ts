import { describe, expect, it } from "vitest";
import { batchCall, call } from "../../index.js";
import { BOOLEAN, GOBJECT, GOBJECT_BORROWED, GTK_LIB, INT32, STRING, STRING_BORROWED } from "./utils.js";

describe("batchCall", () => {
    it("executes multiple void calls in a single dispatch", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

        batchCall([
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_text",
                args: [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: "Batched" },
                ],
            },
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_selectable",
                args: [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: BOOLEAN, value: true },
                ],
            },
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_max_width_chars",
                args: [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 50 },
                ],
            },
        ]);

        const text = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label }], STRING_BORROWED);
        const selectable = call(
            GTK_LIB,
            "gtk_label_get_selectable",
            [{ type: GOBJECT_BORROWED, value: label }],
            BOOLEAN,
        );
        const maxWidthChars = call(
            GTK_LIB,
            "gtk_label_get_max_width_chars",
            [{ type: GOBJECT_BORROWED, value: label }],
            INT32,
        );

        expect(text).toBe("Batched");
        expect(selectable).toBe(true);
        expect(maxWidthChars).toBe(50);
    });

    it("handles empty batch array", () => {
        expect(() => batchCall([])).not.toThrow();
    });

    it("handles single call in batch", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

        batchCall([
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_text",
                args: [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: "Single" },
                ],
            },
        ]);

        const text = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label }], STRING_BORROWED);

        expect(text).toBe("Single");
    });

    it("applies operations on multiple widgets", () => {
        const label1 = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Label 1" }], GOBJECT);
        const label2 = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Label 2" }], GOBJECT);

        batchCall([
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_text",
                args: [
                    { type: GOBJECT_BORROWED, value: label1 },
                    { type: STRING, value: "Updated 1" },
                ],
            },
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_text",
                args: [
                    { type: GOBJECT_BORROWED, value: label2 },
                    { type: STRING, value: "Updated 2" },
                ],
            },
        ]);

        const text1 = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label1 }], STRING_BORROWED);
        const text2 = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label2 }], STRING_BORROWED);

        expect(text1).toBe("Updated 1");
        expect(text2).toBe("Updated 2");
    });
});
