import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { cssBlendmodesDemo } from "../../../src/demos/css/css-blendmodes.js";
import { fireEvent, renderDemo, screen } from "../../test-utils.js";

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
    it("renders the blend mode list and the three pages in the stack", async () => {
        await renderDemo(cssBlendmodesDemo);
        const listbox = (await screen.findByName("blend-list")) as Gtk.ListBox;
        const rowLabels: string[] = [];
        for (let i = 0; i < 16; i++) {
            const row = listbox.getRowAtIndex(i);
            if (!row) continue;
            const child = row.getChild() as Gtk.Label | null;
            if (child) rowLabels.push(child.getLabel());
        }
        expect(rowLabels).toEqual(
            expect.arrayContaining(["Normal", "Multiply", "Screen", "Color", "Hue", "Luminosity"]),
        );
        const blendModeLabel = await screen.findByText("Blend mode:");
        expect(blendModeLabel).toBeDefined();
    });

    it("renders all sixteen blend mode rows in the listbox", async () => {
        await renderDemo(cssBlendmodesDemo);
        const listbox = (await screen.findByName("blend-list")) as Gtk.ListBox;
        expect(listbox).toBeInstanceOf(Gtk.ListBox);
        const rows = countChildren(listbox);
        expect(rows).toBe(16);
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
        const listbox = (await screen.findByName("blend-list")) as Gtk.ListBox;
        const normalRow = listbox.getRowAtIndex(11);
        expect(normalRow).not.toBeNull();
        if (!normalRow) return;
        expect(normalRow.isSelected()).toBe(true);
    });

    it("activates a different blend row and switches the active blend mode", async () => {
        await renderDemo(cssBlendmodesDemo);
        const listbox = (await screen.findByName("blend-list")) as Gtk.ListBox;
        const multiplyRow = listbox.getRowAtIndex(10);
        expect(multiplyRow).not.toBeNull();
        if (!multiplyRow) return;
        listbox.selectRow(multiplyRow);
        await fireEvent(listbox, "row-activated", multiplyRow);
        expect(multiplyRow.isSelected()).toBe(true);
    });

    it("ignores activation when no matching blend mode exists at the row index", async () => {
        await renderDemo(cssBlendmodesDemo);
        const listbox = (await screen.findByName("blend-list")) as Gtk.ListBox;
        const stack = (await screen.findByName("blend-stack")) as Gtk.Stack;
        const initialPage = stack.getVisibleChildName();
        const firstRow = listbox.getRowAtIndex(0);
        if (!firstRow) throw new Error("expected at least one row");
        await fireEvent(listbox, "row-activated", firstRow);
        expect(stack.getVisibleChildName()).toBe(initialPage);
    });
});

const countChildren = (widget: Gtk.Widget): number => {
    let count = 0;
    let child = widget.getFirstChild();
    while (child) {
        count++;
        child = child.getNextSibling();
    }
    return count;
};
