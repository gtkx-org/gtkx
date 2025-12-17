import { describe, expect, it } from "vitest";
import { batchCall, call } from "../index.js";
import { GTK_LIB } from "./utils.js";

describe("batchCall", () => {
    it("executes multiple void calls in a single dispatch", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
            type: "gobject",
        });

        batchCall([
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_text",
                args: [
                    { type: { type: "gobject" }, value: label },
                    { type: { type: "string" }, value: "Batched" },
                ],
            },
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_selectable",
                args: [
                    { type: { type: "gobject" }, value: label },
                    { type: { type: "boolean" }, value: true },
                ],
            },
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_max_width_chars",
                args: [
                    { type: { type: "gobject" }, value: label },
                    { type: { type: "int", size: 32 }, value: 50 },
                ],
            },
        ]);

        const text = call(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: { type: "gobject", borrowed: true }, value: label }],
            { type: "string" },
        );
        const selectable = call(
            GTK_LIB,
            "gtk_label_get_selectable",
            [{ type: { type: "gobject", borrowed: true }, value: label }],
            { type: "boolean" },
        );
        const maxWidthChars = call(
            GTK_LIB,
            "gtk_label_get_max_width_chars",
            [{ type: { type: "gobject", borrowed: true }, value: label }],
            { type: "int", size: 32 },
        );

        expect(text).toBe("Batched");
        expect(selectable).toBe(true);
        expect(maxWidthChars).toBe(50);
    });

    it("handles empty batch array", () => {
        expect(() => batchCall([])).not.toThrow();
    });

    it("handles single call in batch", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
            type: "gobject",
        });

        batchCall([
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_text",
                args: [
                    { type: { type: "gobject" }, value: label },
                    { type: { type: "string" }, value: "Single" },
                ],
            },
        ]);

        const text = call(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: { type: "gobject", borrowed: true }, value: label }],
            { type: "string" },
        );

        expect(text).toBe("Single");
    });

    it("applies operations on multiple widgets", () => {
        const label1 = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Label 1" }], {
            type: "gobject",
        });
        const label2 = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Label 2" }], {
            type: "gobject",
        });

        batchCall([
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_text",
                args: [
                    { type: { type: "gobject" }, value: label1 },
                    { type: { type: "string" }, value: "Updated 1" },
                ],
            },
            {
                library: GTK_LIB,
                symbol: "gtk_label_set_text",
                args: [
                    { type: { type: "gobject" }, value: label2 },
                    { type: { type: "string" }, value: "Updated 2" },
                ],
            },
        ]);

        const text1 = call(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: { type: "gobject", borrowed: true }, value: label1 }],
            { type: "string" },
        );
        const text2 = call(
            GTK_LIB,
            "gtk_label_get_text",
            [{ type: { type: "gobject", borrowed: true }, value: label2 }],
            { type: "string" },
        );

        expect(text1).toBe("Updated 1");
        expect(text2).toBe("Updated 2");
    });
});
