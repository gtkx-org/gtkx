import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { stackDemo } from "../../../src/demos/navigation/stack.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const findStack = (root: Gtk.Widget): Gtk.Stack | null => {
    if (root instanceof Gtk.Stack) return root;
    let child = root.getFirstChild();
    while (child) {
        const found = findStack(child);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

const findSwitcher = (root: Gtk.Widget): Gtk.StackSwitcher | null => {
    if (root instanceof Gtk.StackSwitcher) return root;
    let child = root.getFirstChild();
    while (child) {
        const found = findSwitcher(child);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

describe("stackDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(stackDemo, { id: "stack", title: "Stack" });
        expect(typeof stackDemo.sourceCode).toBe("string");
        expect(stackDemo.keywords).toContain("GtkStack");
        expect(stackDemo.keywords).toContain("GtkStackSwitcher");
    });
});

describe("stackDemo structure", () => {
    it("renders a GtkStack containing three pages", async () => {
        const { container } = await renderDemo(stackDemo);
        const stack = findStack(container);
        expect(stack).toBeInstanceOf(Gtk.Stack);
        expect(stack?.getPages().getNItems()).toBe(3);
    });

    it("renders a GtkStackSwitcher tied to the stack", async () => {
        const { container } = await renderDemo(stackDemo);
        const switcher = findSwitcher(container);
        expect(switcher).toBeInstanceOf(Gtk.StackSwitcher);
        expect(switcher?.getStack()).toBeInstanceOf(Gtk.Stack);
    });
});

describe("stackDemo pages", () => {
    it("declares pages with the expected titles and ids", async () => {
        const { container } = await renderDemo(stackDemo);
        const stack = findStack(container);
        if (!stack) throw new Error("stack widget not found");

        const page1Child = stack.getChildByName("page1");
        const page2Child = stack.getChildByName("page2");
        const page3Child = stack.getChildByName("page3");

        if (!page1Child || !page2Child || !page3Child) throw new Error("stack pages missing");

        expect(stack.getPage(page1Child).getTitle()).toBe("Page 1");
        expect(stack.getPage(page2Child).getTitle()).toBe("Page 2");
        expect(stack.getPage(page3Child).getIconName()).toBe("face-laugh-symbolic");
    });

    it("renders the Page 2 check button inside the stack", async () => {
        const { container } = await renderDemo(stackDemo);
        const stack = findStack(container);
        const page2Child = stack?.getChildByName("page2") as Gtk.CheckButton | null;
        expect(page2Child).toBeInstanceOf(Gtk.CheckButton);
        expect(page2Child?.getLabel()).toBe("Page 2");
    });
});
