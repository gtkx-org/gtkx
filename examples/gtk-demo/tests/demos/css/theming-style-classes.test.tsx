import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { themingStyleClassesDemo } from "../../../src/demos/css/theming-style-classes.js";
import { renderDemo, screen } from "../../test-utils.js";

describe("themingStyleClassesDemo", () => {
    it("exposes the expected metadata", () => {
        expect(themingStyleClassesDemo.id).toBe("theming-style-classes");
        expect(themingStyleClassesDemo.title).toBe("Theming/Style Classes");
        expect(themingStyleClassesDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(themingStyleClassesDemo.keywords)).toBe(true);
        expect(typeof themingStyleClassesDemo.sourceCode).toBe("string");
        expect(themingStyleClassesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(themingStyleClassesDemo.component).toBeTypeOf("function");
    });

    it("renders the linked button group with three buttons", async () => {
        await renderDemo(themingStyleClassesDemo);
        const first = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hi, I am a button" });
        const second = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "And I'm another button" });
        const third = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "This is a button party!" });
        expect(first).toBeInstanceOf(Gtk.Button);
        expect(second).toBeInstanceOf(Gtk.Button);
        expect(third).toBeInstanceOf(Gtk.Button);
        const parent = (first as Gtk.Button).getParent();
        expect(parent).toBeInstanceOf(Gtk.Box);
        expect((parent as Gtk.Box).hasCssClass("linked")).toBe(true);
    });

    it("renders the suggested and destructive action buttons with their style classes", async () => {
        await renderDemo(themingStyleClassesDemo);
        const plain = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Plain" })) as Gtk.Button;
        const destructive = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Destructive",
        })) as Gtk.Button;
        const suggested = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Suggested" })) as Gtk.Button;
        expect(plain.hasCssClass("destructive-action")).toBe(false);
        expect(plain.hasCssClass("suggested-action")).toBe(false);
        expect(destructive.hasCssClass("destructive-action")).toBe(true);
        expect(suggested.hasCssClass("suggested-action")).toBe(true);
    });

    it("applies the configured spacing and margins on the root grid", async () => {
        await renderDemo(themingStyleClassesDemo);
        const grid = (await screen.findByName("root-grid")) as Gtk.Grid;
        expect(grid).not.toBeNull();
        expect(grid.getRowSpacing()).toBe(10);
        expect(grid.getMarginStart()).toBe(10);
        expect(grid.getMarginEnd()).toBe(10);
        expect(grid.getMarginTop()).toBe(10);
        expect(grid.getMarginBottom()).toBe(10);
        expect(grid.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
    });
});
