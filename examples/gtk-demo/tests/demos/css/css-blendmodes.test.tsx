import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssBlendmodesDemo } from "../../../src/demos/css/css-blendmodes.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findFirstOfType } from "../../helpers/traverse.js";

describe("cssBlendmodesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(cssBlendmodesDemo.id).toBe("css-blendmodes");
        expect(cssBlendmodesDemo.title).toBe("Theming/CSS Blend Modes");
        expect(cssBlendmodesDemo.description.length).toBeGreaterThan(0);
        expect(cssBlendmodesDemo.keywords).toEqual(
            expect.arrayContaining(["css", "blend", "mode", "multiply", "screen", "overlay"]),
        );
        expect(typeof cssBlendmodesDemo.sourceCode).toBe("string");
        expect(cssBlendmodesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssBlendmodesDemo.defaultWidth).toBe(400);
        expect(cssBlendmodesDemo.defaultHeight).toBe(300);
        expect(cssBlendmodesDemo.component).toBeTypeOf("function");
    });
});

describe("cssBlendmodesDemo rendering", () => {
    it("renders the blend mode list and the three pages in the stack", async () => {
        if (!cssBlendmodesDemo.component) throw new Error("css-blendmodes demo component missing");
        const { container } = await renderDemo(cssBlendmodesDemo.component);
        expect(findLabelWithText(container, "Blend mode:")).toBeInstanceOf(Gtk.Label);
        expect(findLabelWithText(container, "Normal")).toBeInstanceOf(Gtk.Label);
        expect(findLabelWithText(container, "Multiply")).toBeInstanceOf(Gtk.Label);
        expect(findLabelWithText(container, "Screen")).toBeInstanceOf(Gtk.Label);
    });

    it("renders all sixteen blend mode rows in the listbox", async () => {
        if (!cssBlendmodesDemo.component) throw new Error("css-blendmodes demo component missing");
        const { container } = await renderDemo(cssBlendmodesDemo.component);
        const listbox = findFirstOfType(container, Gtk.ListBox);
        expect(listbox).toBeInstanceOf(Gtk.ListBox);
        if (!listbox) return;
        const rows = countChildren(listbox);
        expect(rows).toBe(16);
    });

    it("renders the stack with the expected page identifiers", async () => {
        if (!cssBlendmodesDemo.component) throw new Error("css-blendmodes demo component missing");
        const { container } = await renderDemo(cssBlendmodesDemo.component);
        const stack = findFirstOfType(container, Gtk.Stack);
        expect(stack).toBeInstanceOf(Gtk.Stack);
        if (!stack) return;
        expect(stack.getChildByName("page0")).toBeInstanceOf(Gtk.Widget);
        expect(stack.getChildByName("page1")).toBeInstanceOf(Gtk.Widget);
        expect(stack.getChildByName("page2")).toBeInstanceOf(Gtk.Widget);
    });
});

describe("cssBlendmodesDemo behavior", () => {
    it("selects the Normal row by default once the listbox is mounted", async () => {
        if (!cssBlendmodesDemo.component) throw new Error("css-blendmodes demo component missing");
        const { container } = await renderDemo(cssBlendmodesDemo.component);
        const listbox = findFirstOfType(container, Gtk.ListBox) as Gtk.ListBox;
        const normalRow = listbox.getRowAtIndex(11);
        expect(normalRow).not.toBeNull();
        if (!normalRow) return;
        expect(normalRow.isSelected()).toBe(true);
    });

    it("activates a different blend row and switches the active blend mode", async () => {
        if (!cssBlendmodesDemo.component) throw new Error("css-blendmodes demo component missing");
        const { container } = await renderDemo(cssBlendmodesDemo.component);
        const listbox = findFirstOfType(container, Gtk.ListBox) as Gtk.ListBox;
        const multiplyRow = listbox.getRowAtIndex(10);
        expect(multiplyRow).not.toBeNull();
        if (!multiplyRow) return;
        listbox.selectRow(multiplyRow);
        await fireEvent(listbox as Gtk.Widget, "row-activated", multiplyRow);
        expect(multiplyRow.isSelected()).toBe(true);
    });

    it("ignores activation when no matching blend mode exists at the row index", async () => {
        if (!cssBlendmodesDemo.component) throw new Error("css-blendmodes demo component missing");
        const { container } = await renderDemo(cssBlendmodesDemo.component);
        const listbox = findFirstOfType(container, Gtk.ListBox) as Gtk.ListBox;
        const stack = findFirstOfType(container, Gtk.Stack) as Gtk.Stack;
        const initialPage = stack.getVisibleChildName();
        const firstRow = listbox.getRowAtIndex(0);
        if (!firstRow) throw new Error("expected at least one row");
        await fireEvent(listbox as Gtk.Widget, "row-activated", firstRow);
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

const findLabelWithText = (root: Gtk.Widget, label: string): Gtk.Label | null => {
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof Gtk.Label && node.getLabel() === label) return node;
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return null;
};
