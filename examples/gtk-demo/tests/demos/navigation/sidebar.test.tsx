import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor, within } from "@gtkx/testing";
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

describe("sidebarDemo navigation", () => {
    it("switches the stack to the page whose sidebar row is activated", async () => {
        await renderDemo(sidebarDemo);
        const stack = await findStack();
        expect(stack.getVisibleChildName()).toBe("Welcome to GTK");

        const sidebar = await findSidebar();
        const scrollingRow = within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Scrolling" });
        await userEvent.click(scrollingRow);

        await waitFor(() => expect(stack.getVisibleChildName()).toBe("Scrolling"));
    });

    it("reflects programmatic stack changes back through the sidebar row selection", async () => {
        await renderDemo(sidebarDemo);
        const stack = await findStack();
        const sidebar = await findSidebar();

        await act(() => stack.setVisibleChildName("Page 7"));
        await waitFor(() => expect(stack.getVisibleChildName()).toBe("Page 7"));

        await waitFor(() => {
            const row = within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Page 7", selected: true });
            expect(row).toBeInstanceOf(Gtk.ListBoxRow);
        });
    });
});
