import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen, userEvent } from "@gtkx/testing";
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

    it("renders the stack with the expected page identifiers", async () => {
        await renderDemo(cssBlendmodesDemo);
        const stack = (await screen.findByName("blend-stack")) as Gtk.Stack;
        expect(stack).toBeInstanceOf(Gtk.Stack);
        expect(stack.getChildByName("page0")).toBeInstanceOf(Gtk.Widget);
        expect(stack.getChildByName("page1")).toBeInstanceOf(Gtk.Widget);
        expect(stack.getChildByName("page2")).toBeInstanceOf(Gtk.Widget);
    });
});

describe("cssBlendmodesDemo behavior", () => {
    it("selects the Normal row by default once the listbox is mounted", async () => {
        await renderDemo(cssBlendmodesDemo);
        const normalRow = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Normal" });
        expect((normalRow as Gtk.ListBoxRow).isSelected()).toBe(true);
    });

    it("activates a different blend row and switches the active blend mode", async () => {
        await renderDemo(cssBlendmodesDemo);
        const multiplyRow = (await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: "Multiply",
        })) as Gtk.ListBoxRow;
        const listbox = (await screen.findByName("blend-list")) as Gtk.ListBox;
        await userEvent.selectOptions(listbox, multiplyRow.getIndex());
        await fireEvent(listbox, "row-activated", multiplyRow);
        expect(multiplyRow.isSelected()).toBe(true);
    });

    it("ignores activation when no matching blend mode exists at the row index", async () => {
        await renderDemo(cssBlendmodesDemo);
        const listbox = (await screen.findByName("blend-list")) as Gtk.ListBox;
        const stack = (await screen.findByName("blend-stack")) as Gtk.Stack;
        const initialPage = stack.getVisibleChildName();
        const firstRow = listbox.getRowAtIndex(0);
        expect(firstRow).toBeInstanceOf(Gtk.ListBoxRow);
        await fireEvent(listbox, "row-activated", firstRow);
        expect(stack.getVisibleChildName()).toBe(initialPage);
    });
});
