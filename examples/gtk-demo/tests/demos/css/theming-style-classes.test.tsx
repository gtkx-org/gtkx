import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { themingStyleClassesDemo } from "../../../src/demos/css/theming-style-classes.js";
import { renderDemo } from "../../test-utils.js";

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
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hi, I am a button" });
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "And I'm another button" });
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "This is a button party!" });
        const linkedBox = (await screen.findByName("linked-buttons")) as Gtk.Box;
        expect(linkedBox.hasCssClass("linked")).toBe(true);
        expect(linkedBox.hasCssClass("suggested-action")).toBe(false);
        expect(linkedBox.hasCssClass("destructive-action")).toBe(false);
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

    it("places the linked group and the action group in separate grid rows", async () => {
        await renderDemo(themingStyleClassesDemo);
        const grid = (await screen.findByName("root-grid")) as Gtk.Grid;
        const linkedBox = (await screen.findByName("linked-buttons")) as Gtk.Box;
        const suggested = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Suggested" })) as Gtk.Button;

        expect(grid.getChildAt(0, 0)).toBe(linkedBox);
        const actionRow = grid.getChildAt(0, 1);
        expect(actionRow).not.toBeNull();
        expect(suggested.getParent()).toBe(actionRow);
    });
});
