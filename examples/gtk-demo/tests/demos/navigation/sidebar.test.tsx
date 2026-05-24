import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { sidebarDemo } from "../../../src/demos/navigation/sidebar.js";
import { renderDemo } from "../../test-utils.js";

const PAGE_TITLES = [
    "Welcome to GTK",
    "GtkStackSidebar Widget",
    "Automatic navigation",
    "Consistent appearance",
    "Scrolling",
    "Page 6",
    "Page 7",
    "Page 8",
    "Page 9",
];

const findStack = async (): Promise<Gtk.Stack> => (await screen.findByName("stack")) as Gtk.Stack;
const findSidebar = async (): Promise<Gtk.StackSidebar> => (await screen.findByName("sidebar")) as Gtk.StackSidebar;

describe("sidebarDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(sidebarDemo.id).toBe("sidebar");
        expect(sidebarDemo.title).toBe("Stack Sidebar");
        expect(sidebarDemo.description.length).toBeGreaterThan(0);
        expect(typeof sidebarDemo.sourceCode).toBe("string");
        expect(Array.isArray(sidebarDemo.keywords)).toBe(true);
    });
});

describe("sidebarDemo structure", () => {
    it("registers nine stack pages with the expected titles", async () => {
        await renderDemo(sidebarDemo);
        const stack = await findStack();
        expect(stack.getPages().getNItems()).toBe(9);
        for (const title of PAGE_TITLES) {
            const child = stack.getChildByName(title);
            expect(child).not.toBeNull();
            expect(stack.getPage(child as Gtk.Widget).getTitle()).toBe(title);
        }
    });

    it("binds the GtkStackSidebar to the stack", async () => {
        await renderDemo(sidebarDemo);
        const sidebar = await findSidebar();
        const stack = await findStack();
        expect(sidebar.getStack()).toBe(stack);
    });

    it("uses a 256px decorated icon for the welcome page", async () => {
        await renderDemo(sidebarDemo);
        const stack = await findStack();
        const welcome = stack.getChildByName("Welcome to GTK");
        expect(welcome).toBeInstanceOf(Gtk.Image);
        const image = welcome as Gtk.Image;
        expect(image.getPixelSize()).toBe(256);
        expect(image.hasCssClass("icon-dropshadow")).toBe(true);
    });

    it("uses a plain GtkLabel for non-welcome pages", async () => {
        await renderDemo(sidebarDemo);
        const stack = await findStack();
        const scrolling = stack.getChildByName("Scrolling");
        expect(scrolling).toBeInstanceOf(Gtk.Label);
        expect((scrolling as Gtk.Label).getLabel()).toBe("Scrolling");
    });
});
