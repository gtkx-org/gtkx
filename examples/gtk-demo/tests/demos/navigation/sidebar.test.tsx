import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { sidebarDemo } from "../../../src/demos/navigation/sidebar.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const findFirst = <T extends Gtk.Widget>(root: Gtk.Widget, predicate: (w: Gtk.Widget) => w is T): T | null => {
    if (predicate(root)) return root;
    let child = root.getFirstChild();
    while (child) {
        const found = findFirst(child, predicate);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

describe("sidebarDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(sidebarDemo, { id: "sidebar", title: "Stack Sidebar" });
        expect(typeof sidebarDemo.sourceCode).toBe("string");
        expect(sidebarDemo.keywords).toContain("GtkStackSidebar");
    });

    it("renders a GtkStack with the nine declared pages", async () => {
        if (!sidebarDemo.component) throw new Error("sidebar demo component missing");
        const { container } = await renderDemo(sidebarDemo.component);
        const stack = findFirst(container, (w): w is Gtk.Stack => w instanceof Gtk.Stack);
        expect(stack).toBeInstanceOf(Gtk.Stack);
        expect(stack?.getPages().getNItems()).toBe(9);
    });

    it("renders a GtkStackSidebar bound to the stack", async () => {
        if (!sidebarDemo.component) throw new Error("sidebar demo component missing");
        const { container } = await renderDemo(sidebarDemo.component);
        const sidebar = findFirst(container, (w): w is Gtk.StackSidebar => w instanceof Gtk.StackSidebar);
        expect(sidebar).toBeInstanceOf(Gtk.StackSidebar);
        expect(sidebar?.getStack()).toBeInstanceOf(Gtk.Stack);
    });

    it("uses page titles from the declared pages list", async () => {
        if (!sidebarDemo.component) throw new Error("sidebar demo component missing");
        const { container } = await renderDemo(sidebarDemo.component);
        const stack = findFirst(container, (w): w is Gtk.Stack => w instanceof Gtk.Stack);
        if (!stack) throw new Error("stack widget not found");
        const welcome = stack.getChildByName("Welcome to GTK");
        expect(welcome).not.toBeNull();
        const page = stack.getPage(welcome as Gtk.Widget);
        expect(page.getTitle()).toBe("Welcome to GTK");
    });

    it("renders a GtkPicture on the first page and labels on other pages", async () => {
        if (!sidebarDemo.component) throw new Error("sidebar demo component missing");
        const { container } = await renderDemo(sidebarDemo.component);
        const stack = findFirst(container, (w): w is Gtk.Stack => w instanceof Gtk.Stack);
        if (!stack) throw new Error("stack widget not found");

        const welcome = stack.getChildByName("Welcome to GTK");
        expect(welcome).not.toBeNull();
        const picture = findFirst(welcome as Gtk.Widget, (w): w is Gtk.Picture => w instanceof Gtk.Picture);
        expect(picture).toBeInstanceOf(Gtk.Picture);

        const scrolling = stack.getChildByName("Scrolling");
        expect(scrolling).not.toBeNull();
        const label = findFirst(scrolling as Gtk.Widget, (w): w is Gtk.Label => w instanceof Gtk.Label);
        expect(label?.getLabel()).toBe("Scrolling");
    });
});
