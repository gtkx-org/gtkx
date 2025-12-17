import { describe, expect, it } from "vitest";
import * as Gdk from "../../src/generated/gdk/index.js";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("properties", () => {
    describe("boxed type properties", () => {
        it("reads float property", () => {
            const rgba = new Gdk.RGBA({ red: 0.5 });
            expect(rgba.red).toBeCloseTo(0.5);
        });

        it("writes float property", () => {
            const rgba = new Gdk.RGBA();
            rgba.red = 0.75;
            expect(rgba.red).toBeCloseTo(0.75);
        });

        it("reads multiple properties from same instance", () => {
            const rgba = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.25, alpha: 0.8 });
            expect(rgba.red).toBeCloseTo(1.0);
            expect(rgba.green).toBeCloseTo(0.5);
            expect(rgba.blue).toBeCloseTo(0.25);
            expect(rgba.alpha).toBeCloseTo(0.8);
        });

        it("writes multiple properties to same instance", () => {
            const rgba = new Gdk.RGBA();
            rgba.red = 0.1;
            rgba.green = 0.2;
            rgba.blue = 0.3;
            rgba.alpha = 0.4;
            expect(rgba.red).toBeCloseTo(0.1);
            expect(rgba.green).toBeCloseTo(0.2);
            expect(rgba.blue).toBeCloseTo(0.3);
            expect(rgba.alpha).toBeCloseTo(0.4);
        });

        it("reads integer property from boxed type with default", () => {
            const border = new Gtk.Border();
            expect(border.left).toBe(0);
            expect(border.right).toBe(0);
            expect(border.top).toBe(0);
            expect(border.bottom).toBe(0);
        });

        it("writes and reads integer property on boxed type", () => {
            const border = new Gtk.Border();
            border.left = 15;
            border.right = 25;
            expect(border.left).toBe(15);
            expect(border.right).toBe(25);
        });
    });

    describe("gobject getter/setter methods", () => {
        it("gets string property via getter method", () => {
            const label = new Gtk.Label("Test Text");
            expect(label.getText()).toBe("Test Text");
        });

        it("sets string property via setter method", () => {
            const label = new Gtk.Label("Initial");
            label.setText("Updated");
            expect(label.getText()).toBe("Updated");
        });

        it("gets boolean property via getter method", () => {
            const button = new Gtk.Button();
            expect(typeof button.getUseUnderline()).toBe("boolean");
        });

        it("sets boolean property via setter method", () => {
            const button = new Gtk.Button();
            button.setUseUnderline(true);
            expect(button.getUseUnderline()).toBe(true);
        });

        it("gets integer property via getter method", () => {
            const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 5);
            expect(box.getSpacing()).toBe(5);
        });

        it("sets integer property via setter method", () => {
            const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0);
            box.setSpacing(15);
            expect(box.getSpacing()).toBe(15);
        });

        it("gets nullable property returning null", () => {
            const button = new Gtk.Button();
            expect(button.getLabel()).toBeNull();
        });

        it("gets nullable property returning value", () => {
            const button = Gtk.Button.newWithLabel("Click");
            expect(button.getLabel()).toBe("Click");
        });

        it("sets nullable property to value", () => {
            const button = new Gtk.Button();
            button.setLabel("New Label");
            expect(button.getLabel()).toBe("New Label");
        });
    });
});
