import { describe, expect, it } from "vitest";
import * as Gdk from "../../src/generated/gdk/index.js";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("methods", () => {
    it("calls method with no parameters", () => {
        const label = new Gtk.Label("Test");
        const text = label.getText();
        expect(text).toBe("Test");
    });

    it("calls method with string parameter", () => {
        const label = new Gtk.Label("Initial");
        label.setText("Updated");
        expect(label.getText()).toBe("Updated");
    });

    it("calls method with boolean parameter", () => {
        const label = new Gtk.Label("Test");
        label.setSelectable(true);
        expect(label.getSelectable()).toBe(true);
        label.setSelectable(false);
        expect(label.getSelectable()).toBe(false);
    });

    it("calls method with integer parameter", () => {
        const label = new Gtk.Label("Test");
        label.setMaxWidthChars(50);
        expect(label.getMaxWidthChars()).toBe(50);
    });

    it("calls method with float parameter", () => {
        const label = new Gtk.Label("Test");
        label.setXalign(0.5);
        expect(label.getXalign()).toBeCloseTo(0.5);
    });

    it("calls method with enum parameter", () => {
        const label = new Gtk.Label("Test");
        label.setJustify(Gtk.Justification.CENTER);
        expect(label.getJustify()).toBe(Gtk.Justification.CENTER);
    });

    it("calls method with object parameter", () => {
        const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
        const label = new Gtk.Label("Child");
        box.append(label);
        const firstChild = box.getFirstChild();
        expect(firstChild).not.toBeNull();
    });

    it("calls method with optional parameter as undefined", () => {
        const label = new Gtk.Label("Test");
        label.setAttributes(undefined);
    });

    it("calls method returning void", () => {
        const widget = new Gtk.Label("Test");
        expect(() => widget.show()).not.toThrow();
    });

    it("calls method returning boolean", () => {
        const widget = new Gtk.Label("Test");
        const isSensitive = widget.isSensitive();
        expect(typeof isSensitive).toBe("boolean");
    });

    it("calls method returning string", () => {
        const label = new Gtk.Label("Hello");
        const text = label.getText();
        expect(typeof text).toBe("string");
        expect(text).toBe("Hello");
    });

    it("calls method returning nullable object", () => {
        const label = new Gtk.Label("Test");
        const parent = label.getParent();
        expect(parent).toBeNull();
    });

    it("calls method returning object when parent exists", () => {
        const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
        const label = new Gtk.Label("Child");
        box.append(label);
        const parent = label.getParent();
        expect(parent).not.toBeNull();
        expect(parent).toBeInstanceOf(Gtk.Box);
    });

    it("calls method returning boxed type", () => {
        const rgba = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
        const copy = rgba.copy();
        expect(copy.red).toBeCloseTo(1.0);
        expect(copy.green).toBeCloseTo(0.5);
    });

    it("calls method with boxed type parameter", () => {
        const rgba1 = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
        const rgba2 = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
        expect(rgba1.equal(rgba2)).toBe(true);
    });

    it("calls inherited method from parent class", () => {
        const button = new Gtk.Button();
        button.setSensitive(false);
        expect(button.isSensitive()).toBe(false);
    });
});
