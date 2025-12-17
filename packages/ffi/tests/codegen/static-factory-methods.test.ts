import { describe, expect, it } from "vitest";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("static factory methods", () => {
    describe("Button factory methods", () => {
        it("creates Button with newWithLabel", () => {
            const button = Gtk.Button.newWithLabel("Click me");
            expect(button).toBeInstanceOf(Gtk.Button);
            expect(button.getLabel()).toBe("Click me");
        });

        it("creates Button with newFromIconName", () => {
            const button = Gtk.Button.newFromIconName("document-open");
            expect(button).toBeInstanceOf(Gtk.Button);
            expect(button.getIconName()).toBe("document-open");
        });

        it("creates Button with newWithMnemonic", () => {
            const button = Gtk.Button.newWithMnemonic("_Save");
            expect(button).toBeInstanceOf(Gtk.Button);
        });
    });

    describe("Label factory methods", () => {
        it("creates Label with newWithMnemonic", () => {
            const label = Gtk.Label.newWithMnemonic("_File");
            expect(label).toBeInstanceOf(Gtk.Label);
        });
    });

    describe("Image factory methods", () => {
        it("creates Image with newFromIconName", () => {
            const image = Gtk.Image.newFromIconName("dialog-information");
            expect(image).toBeInstanceOf(Gtk.Image);
        });
    });

    describe("Box factory methods", () => {
        it("creates Box with standard constructor", () => {
            const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 10);
            expect(box).toBeInstanceOf(Gtk.Box);
            expect(box.getSpacing()).toBe(10);
        });
    });

    describe("Scale factory methods", () => {
        it("creates Scale with newWithRange", () => {
            const scale = Gtk.Scale.newWithRange(Gtk.Orientation.HORIZONTAL, 0, 100, 1);
            expect(scale).toBeInstanceOf(Gtk.Scale);
        });
    });

    describe("Adjustment factory methods", () => {
        it("creates Adjustment with standard constructor", () => {
            const adjustment = new Gtk.Adjustment(50, 0, 100, 1, 10, 0);
            expect(adjustment).toBeInstanceOf(Gtk.Adjustment);
            expect(adjustment.getValue()).toBe(50);
        });
    });

    describe("Entry factory methods", () => {
        it("creates Entry with standard constructor", () => {
            const entry = new Gtk.Entry();
            expect(entry).toBeInstanceOf(Gtk.Entry);
        });
    });
});
