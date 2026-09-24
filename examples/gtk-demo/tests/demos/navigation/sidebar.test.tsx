import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
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

const findStack = async (): Promise<Gtk.Stack> => screen.findByName("stack", { as: Gtk.Stack });
const findSidebar = async (): Promise<Gtk.StackSidebar> => screen.findByName("sidebar", { as: Gtk.StackSidebar });

const renderSidebarAndStack = async (): Promise<{ sidebar: Gtk.StackSidebar; stack: Gtk.Stack }> => {
    await renderDemo(sidebarDemo);
    const sidebar = await findSidebar();
    const stack = await findStack();

    return { sidebar, stack };
};

const clickPageRow = async (sidebar: Gtk.StackSidebar, name: string): Promise<void> => {
    await userEvent.click(within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name }));
};

describe("sidebarDemo structure", () => {
    it("registers nine stack pages with the expected titles", async () => {
        await renderDemo(sidebarDemo);
        const sidebar = await findSidebar();
        expect(await within(sidebar).findAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(9);

        for (const title of PAGE_TITLES) {
            within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title });
        }
    });

    it("shows the named 256px logo on the welcome page", async () => {
        await renderDemo(sidebarDemo);
        const stack = await findStack();
        const image = await within(stack).findByRole(Gtk.AccessibleRole.IMG, {
            name: "GTK Demo logo",
            as: Gtk.Image,
        });

        expect(image).toHaveObjectProperty("pixelSize", 256);
        expect(image).toHaveClass("icon-dropshadow");
    });

    it("uses a plain GtkLabel for non-welcome pages", async () => {
        const { sidebar, stack } = await renderSidebarAndStack();
        expect(within(stack).queryByRole(Gtk.AccessibleRole.LABEL, { name: "Scrolling" })).toBeNull();
        await clickPageRow(sidebar, "Scrolling");
        const label = await within(stack).findByRole(Gtk.AccessibleRole.LABEL, { name: "Scrolling" });
        expect(stack.getVisibleChild()).toContainElement(label);
    });
});

describe("sidebarDemo navigation", () => {
    it("switches the stack to the page whose sidebar row is activated", async () => {
        const { sidebar, stack } = await renderSidebarAndStack();
        expect(stack).toHaveObjectProperty("visibleChildName", "Welcome to GTK");
        within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Welcome to GTK", selected: true });
        await clickPageRow(sidebar, "Scrolling");

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "Scrolling");
        });

        within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Scrolling", selected: true });
        await clickPageRow(sidebar, "Page 9");

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "Page 9");
        });

        await clickPageRow(sidebar, "Welcome to GTK");

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "Welcome to GTK");
        });
    });
});
