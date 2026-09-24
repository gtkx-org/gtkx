import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssBlendmodesDemo } from "../../../src/demos/css/css-blendmodes.js";
import { renderDemo } from "../../test-utils.js";

const blendClasses = (grid: Gtk.Grid): string[] => grid.getCssClasses().filter((name) => name.startsWith("gtkx-"));

const selectRow = async (name: string): Promise<void> => {
    const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name, as: Gtk.ListBoxRow });
    await userEvent.click(row);
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
        within(stack).getByRole(Gtk.AccessibleRole.IMG, { name: "Duck source" });
        within(stack).getByRole(Gtk.AccessibleRole.IMG, { name: "Blended picture" });
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Blends" }));
        await screen.findByText("Red");
        expect(stack).toHaveObjectProperty("visibleChildName", "page1");
        within(stack).getByText("Blue");
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "CMYK" }));
        await screen.findByText("Cyan");
        expect(stack).toHaveObjectProperty("visibleChildName", "page2");
        within(stack).getByText("Yellow");
        within(stack).getByRole(Gtk.AccessibleRole.IMG, { name: "Cyan source" });
        within(stack).getByRole(Gtk.AccessibleRole.IMG, { name: "Blended CMYK picture" });
    });
});

describe("cssBlendmodesDemo behavior", () => {
    it("selects the Normal row by default once the listbox is mounted", async () => {
        await renderDemo(cssBlendmodesDemo);
        const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Normal", selected: true });
        expect(row).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
    });

    it("regenerates the root grid blend-mode css class when a blend row is selected", async () => {
        await renderDemo(cssBlendmodesDemo);
        const grid = await screen.findByName("blend-root", { as: Gtk.Grid });
        const initialClasses = blendClasses(grid);
        expect(initialClasses).toHaveLength(1);
        await selectRow("Multiply");

        await waitFor(() => {
            expect(blendClasses(grid)).not.toEqual(initialClasses);
        });

        expect(blendClasses(grid)).toHaveLength(1);
    });

    it("produces a distinct css class for each activated blend mode", async () => {
        await renderDemo(cssBlendmodesDemo);
        const grid = await screen.findByName("blend-root", { as: Gtk.Grid });
        const initial = blendClasses(grid);
        await selectRow("Overlay");
        let overlayClasses: string[] = initial;

        await waitFor(() => {
            overlayClasses = blendClasses(grid);
            expect(overlayClasses).not.toEqual(initial);
        });

        await selectRow("Saturation");

        await waitFor(() => {
            expect(blendClasses(grid)).not.toEqual(overlayClasses);
        });
    });
});
