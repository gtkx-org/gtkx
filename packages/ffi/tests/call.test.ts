import { describe, expect, it } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { call } from "../src/index.js";

describe("call", () => {
    it("calls native GTK functions", () => {
        const label = new Gtk.Label("Initial");
        call(
            "libgtk-4.so.1",
            "gtk_label_set_text",
            [
                { type: { type: "gobject" }, value: label.id },
                { type: { type: "string" }, value: "Updated" },
            ],
            { type: "undefined" },
        );
        expect(label.getText()).toBe("Updated");
    });

    it("returns values from native functions", () => {
        const label = new Gtk.Label("Test Text");
        const text = call(
            "libgtk-4.so.1",
            "gtk_label_get_text",
            [{ type: { type: "gobject", borrowed: true }, value: label.id }],
            { type: "string" },
        );
        expect(text).toBe("Test Text");
    });
});
