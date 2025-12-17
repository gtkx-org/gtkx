import { describe, expect, it } from "vitest";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("nullable returns", () => {
    describe("nullable string returns", () => {
        it("returns null when no label set", () => {
            const button = new Gtk.Button();
            expect(button.getLabel()).toBeNull();
        });

        it("returns value when label is set", () => {
            const button = Gtk.Button.newWithLabel("Click");
            expect(button.getLabel()).toBe("Click");
        });

        it("returns null when no icon name set", () => {
            const button = new Gtk.Button();
            expect(button.getIconName()).toBeNull();
        });

        it("returns value when icon name is set", () => {
            const button = Gtk.Button.newFromIconName("document-open");
            expect(button.getIconName()).toBe("document-open");
        });
    });

    describe("nullable object returns", () => {
        it("returns null when no child set", () => {
            const button = new Gtk.Button();
            expect(button.getChild()).toBeNull();
        });

        it("returns child when set", () => {
            const button = new Gtk.Button();
            const label = new Gtk.Label("Test");
            button.setChild(label);
            const child = button.getChild();
            expect(child).not.toBeNull();
            expect(child).toBeInstanceOf(Gtk.Widget);
        });

        it("returns null when no parent", () => {
            const button = new Gtk.Button();
            expect(button.getParent()).toBeNull();
        });

        it("returns parent when set", () => {
            const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
            const button = new Gtk.Button();
            box.append(button);
            const parent = button.getParent();
            expect(parent).not.toBeNull();
            expect(parent).toBeInstanceOf(Gtk.Box);
        });
    });

    describe("nullable action returns", () => {
        it("returns null when no action name", () => {
            const button = new Gtk.Button();
            expect(button.getActionName()).toBeNull();
        });

        it("returns null when no action target value", () => {
            const button = new Gtk.Button();
            expect(button.getActionTargetValue()).toBeNull();
        });
    });
});
