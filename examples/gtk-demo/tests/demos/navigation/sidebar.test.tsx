import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { sidebarDemo } from "../../../src/demos/navigation/sidebar.js";
import { renderDemo } from "../../test-utils.js";

interface SidebarLayout {
    box: Gtk.Box;
    sidebar: Gtk.StackSidebar;
    stack: Gtk.Stack;
}

const resolveSidebarLayout = (window: Gtk.Window): SidebarLayout => {
    const box = window.getChild();
    if (!(box instanceof Gtk.Box)) throw new Error("expected window child to be a Box");
    const sidebar = box.getFirstChild();
    if (!(sidebar instanceof Gtk.StackSidebar)) throw new Error("expected first box child to be a StackSidebar");
    const stack = box.getLastChild();
    if (!(stack instanceof Gtk.Stack)) throw new Error("expected last box child to be a Stack");
    return { box, sidebar, stack };
};

describe("sidebarDemo", () => {
    it("exposes the expected metadata", () => {
        expect(sidebarDemo.id).toBe("sidebar");
        expect(sidebarDemo.title).toBe("Stack Sidebar");
        expect(sidebarDemo.description.length).toBeGreaterThan(0);
        expect(typeof sidebarDemo.sourceCode).toBe("string");
        expect(Array.isArray(sidebarDemo.keywords)).toBe(true);
    });

    it("renders a GtkStack with the nine declared pages", async () => {
        const { window } = await renderDemo(sidebarDemo);
        if (!window.current) throw new Error("expected window ref");
        const { stack } = resolveSidebarLayout(window.current);
        expect(stack.getPages().getNItems()).toBe(9);
    });

    it("renders a GtkStackSidebar bound to the stack", async () => {
        const { window } = await renderDemo(sidebarDemo);
        if (!window.current) throw new Error("expected window ref");
        const { sidebar } = resolveSidebarLayout(window.current);
        expect(sidebar.getStack()).toBeInstanceOf(Gtk.Stack);
    });

    it("uses page titles from the declared pages list", async () => {
        const { window } = await renderDemo(sidebarDemo);
        if (!window.current) throw new Error("expected window ref");
        const { stack } = resolveSidebarLayout(window.current);
        const welcome = stack.getChildByName("Welcome to GTK");
        if (!welcome) throw new Error("welcome page missing");
        const page = stack.getPage(welcome);
        expect(page.getTitle()).toBe("Welcome to GTK");
    });

    it("renders a GtkImage on the first page and labels on other pages", async () => {
        const { window } = await renderDemo(sidebarDemo);
        if (!window.current) throw new Error("expected window ref");
        const { stack } = resolveSidebarLayout(window.current);

        const welcome = stack.getChildByName("Welcome to GTK");
        if (!welcome) throw new Error("welcome page missing");
        expect(welcome).toBeInstanceOf(Gtk.Image);
        const welcomeImage = welcome as Gtk.Image;
        expect(welcomeImage.getPixelSize()).toBe(256);
        expect(welcomeImage.hasCssClass("icon-dropshadow")).toBe(true);

        const scrolling = stack.getChildByName("Scrolling");
        if (!scrolling) throw new Error("scrolling page missing");
        expect(scrolling).toBeInstanceOf(Gtk.Label);
        expect((scrolling as Gtk.Label).getLabel()).toBe("Scrolling");
    });
});
