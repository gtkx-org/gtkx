import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssBlendmodesDemo } from "../../../src/demos/css/css-blendmodes.js";
import { renderDemo } from "../../test-utils.js";

describe("cssBlendmodesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(cssBlendmodesDemo.id).toBe("css-blendmodes");
        expect(cssBlendmodesDemo.title).toBe("Theming/CSS Blend Modes");
        expect(cssBlendmodesDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(cssBlendmodesDemo.keywords)).toBe(true);
        expect(typeof cssBlendmodesDemo.sourceCode).toBe("string");
        expect(cssBlendmodesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssBlendmodesDemo.defaultWidth).toBe(400);
        expect(cssBlendmodesDemo.defaultHeight).toBe(300);
        expect(cssBlendmodesDemo.component).toBeTypeOf("function");
    });
});

describe("cssBlendmodesDemo rendering", () => {
    it("renders the blend mode list and the Blend mode label", async () => {
        await renderDemo(cssBlendmodesDemo);
        for (const name of ["Normal", "Multiply", "Screen", "Color", "Hue", "Luminosity"]) {
            expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name })).toBeInstanceOf(Gtk.ListBoxRow);
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
        const stack = (await screen.findByName("blend-stack")) as Gtk.Stack;

        expect(within(stack).getByText("Duck")).not.toBeNull();

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Blends" }));
        await screen.findByText("Red");
        expect(within(stack).getByText("Blue")).not.toBeNull();

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "CMYK" }));
        await screen.findByText("Cyan");
        expect(within(stack).getByText("Yellow")).not.toBeNull();
    });
});

describe("cssBlendmodesDemo behavior", () => {
    it("selects the Normal row by default once the listbox is mounted", async () => {
        await renderDemo(cssBlendmodesDemo);
        await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Normal", selected: true });
    });

    it("activates a different blend row and switches the active blend mode", async () => {
        await renderDemo(cssBlendmodesDemo);
        const multiplyRow = (await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: "Multiply",
        })) as Gtk.ListBoxRow;
        const listbox = (await screen.findByName("blend-list")) as Gtk.ListBox;
        await userEvent.selectOptions(listbox, multiplyRow.getIndex());
        await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Multiply", selected: true });
    });

    it("ignores activation when no matching blend mode exists at the row index", async () => {
        await renderDemo(cssBlendmodesDemo);
        const stack = (await screen.findByName("blend-stack")) as Gtk.Stack;
        const initialPage = stack.getVisibleChildName();
        const firstRow = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Color" });
        await userEvent.click(firstRow);
        expect(stack.getVisibleChildName()).toBe(initialPage);
    });
});
