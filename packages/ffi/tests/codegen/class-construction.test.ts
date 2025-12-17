import { describe, expect, it } from "vitest";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("class construction", () => {
    it("creates instance with default constructor", () => {
        const button = new Gtk.Button();
        expect(button).toBeInstanceOf(Gtk.Button);
        expect(button.id).toBeDefined();
    });

    it("creates instance with constructor parameter", () => {
        const label = new Gtk.Label("Hello World");
        expect(label).toBeInstanceOf(Gtk.Label);
        expect(label.getText()).toBe("Hello World");
    });

    it("creates instance with optional constructor parameter", () => {
        const labelWithText = new Gtk.Label("Text");
        const labelWithNull = new Gtk.Label(null);
        expect(labelWithText.getText()).toBe("Text");
        expect(labelWithNull.getText()).toBe("");
    });

    it("creates instance with multiple constructor parameters", () => {
        const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 10);
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(box.getSpacing()).toBe(10);
    });

    it("creates instance with static factory constructor", () => {
        const button = Gtk.Button.newWithLabel("Click Me");
        expect(button).toBeInstanceOf(Gtk.Button);
        expect(button.getLabel()).toBe("Click Me");
    });

    it("creates instance with different static factory constructor", () => {
        const button = Gtk.Button.newWithMnemonic("_Save");
        expect(button).toBeInstanceOf(Gtk.Button);
        expect(button.getLabel()).toBe("_Save");
    });

    it("creates instance with icon name factory constructor", () => {
        const button = Gtk.Button.newFromIconName("document-open");
        expect(button).toBeInstanceOf(Gtk.Button);
        expect(button.getIconName()).toBe("document-open");
    });

    it("has correct glibTypeName static property", () => {
        expect(Gtk.Button.glibTypeName).toBe("GtkButton");
        expect(Gtk.Label.glibTypeName).toBe("GtkLabel");
        expect(Gtk.Box.glibTypeName).toBe("GtkBox");
    });

    it("creates child class instance inheriting from parent", () => {
        const button = new Gtk.Button();
        expect(button).toBeInstanceOf(Gtk.Widget);
    });
});
