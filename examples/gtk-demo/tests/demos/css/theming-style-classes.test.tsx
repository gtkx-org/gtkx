import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { themingStyleClassesDemo } from "../../../src/demos/css/theming-style-classes.js";
import { renderDemo } from "../../test-utils.js";

describe("themingStyleClassesDemo", () => {
    it("renders the linked button group with three buttons", async () => {
        await renderDemo(themingStyleClassesDemo);
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hi, I am a button" });
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "And I'm another button" });
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "This is a button party!" });
        const linkedBox = await screen.findByName("linked-buttons", { as: Gtk.Box });
        expect(linkedBox).toHaveClass("linked");
        expect(linkedBox).not.toHaveClass("suggested-action");
        expect(linkedBox).not.toHaveClass("destructive-action");
    });

    it("renders the suggested and destructive action buttons with their style classes", async () => {
        await renderDemo(themingStyleClassesDemo);
        const plain = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Plain", as: Gtk.Button });

        const destructive = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Destructive",
            as: Gtk.Button,
        });

        const suggested = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Suggested", as: Gtk.Button });
        expect(plain).not.toHaveClass("destructive-action");
        expect(plain).not.toHaveClass("suggested-action");
        expect(destructive).toHaveClass("destructive-action");
        expect(suggested).toHaveClass("suggested-action");
    });

    it("places the linked group and the action group in separate grid rows", async () => {
        await renderDemo(themingStyleClassesDemo);
        const grid = await screen.findByName("root-grid", { as: Gtk.Grid });
        const linkedBox = await screen.findByName("linked-buttons", { as: Gtk.Box });
        const suggested = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Suggested", as: Gtk.Button });
        expect(grid.getChildAt(0, 0)).toBe(linkedBox);
        const actionRow = grid.getChildAt(0, 1);
        expect(actionRow).not.toBeNull();
        expect(suggested.getParent()).toBe(actionRow);
    });
});
