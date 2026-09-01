import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssBlendmodesDemo } from "../../../src/demos/css/css-blendmodes.js";
import { renderDemo } from "../../test-utils.js";

const activateRow = async (name: string): Promise<void> => {
    const listbox = await screen.findByName("blend-list", { as: Gtk.ListBox });
    const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name, as: Gtk.ListBoxRow });
    await userEvent.click(row);
    await userEvent.keyboard(listbox, "{Enter}");
};

describe("cssBlendmodesDemo rendering", () => {
    it("renders the blend mode list and the Blend mode label", async () => {
        await renderDemo(cssBlendmodesDemo);

        for (const name of ["Normal", "Multiply", "Screen", "Color", "Hue", "Luminosity"]) {
            const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name });
            expect(row).toHaveTextContent(name);
        }

        await screen.findByText("Blend mode:");
    });

    it("renders all sixteen blend mode rows in the listbox", async () => {
        await renderDemo(cssBlendmodesDemo);
        const rows = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);
        expect(rows).toHaveLength(16);
    });

    it("switches between the three stack pages and shows each page's content", async () => {
        await renderDemo(cssBlendmodesDemo);
        const stack = await screen.findByName("blend-stack", { as: Gtk.Stack });
        expect(stack).toBeVisible();
        expect(stack).toHaveObjectProperty("visibleChildName", "page0");
        within(stack).getByText("Duck");
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Blends" }));
        await screen.findByText("Red");
        expect(stack).toHaveObjectProperty("visibleChildName", "page1");
        within(stack).getByText("Blue");
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "CMYK" }));
        await screen.findByText("Cyan");
        expect(stack).toHaveObjectProperty("visibleChildName", "page2");
        within(stack).getByText("Yellow");
    });
});

describe("cssBlendmodesDemo behavior", () => {
    it("selects the Normal row by default once the listbox is mounted", async () => {
        await renderDemo(cssBlendmodesDemo);
        const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Normal", selected: true });
        expect(row).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
    });

    it("regenerates the root grid blend-mode css class when a blend row is activated", async () => {
        await renderDemo(cssBlendmodesDemo);
        const grid = await screen.findByName("blend-root", { as: Gtk.Grid });
        const initialClasses = grid.getCssClasses();
        expect(initialClasses).toHaveLength(1);
        await activateRow("Multiply");

        await waitFor(() => {
            expect(grid.getCssClasses()).not.toEqual(initialClasses);
        });

        expect(grid.getCssClasses()).toHaveLength(1);
    });

    it("produces a distinct css class for each activated blend mode", async () => {
        await renderDemo(cssBlendmodesDemo);
        const grid = await screen.findByName("blend-root", { as: Gtk.Grid });
        const initial = grid.getCssClasses();
        await activateRow("Overlay");
        let overlayClasses: string[] = initial;

        await waitFor(() => {
            overlayClasses = grid.getCssClasses();
            expect(overlayClasses).not.toEqual(initial);
        });

        await activateRow("Saturate");

        await waitFor(() => {
            expect(grid.getCssClasses()).not.toEqual(overlayClasses);
        });
    });
});
