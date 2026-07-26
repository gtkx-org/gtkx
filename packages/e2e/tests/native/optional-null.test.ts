import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

describe("marshalling - optional null arguments across the napi boundary", () => {
    it("passes a null string to an optional argument of gtk_label_new", () => {
        const label = Gtk.Label.new(null);
        expect(label.getText()).toBe("");
    });

    it("passes a null object to an optional argument of gtk_button_set_child", () => {
        const button = Gtk.Button.new();
        const child = Gtk.Label.new("Child");
        button.setChild(child);
        expect(button.getChild()).not.toBeNull();
        button.setChild(null);
        expect(button.getChild()).toBeNull();
    });
});
