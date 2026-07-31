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

const findStack = async (): Promise<Gtk.Stack> => screen.findByName("stack", { as: Gtk.Stack });
const findSidebar = async (): Promise<Gtk.StackSidebar> => screen.findByName("sidebar", { as: Gtk.StackSidebar });

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
        const sidebar = await findSidebar();
        expect(await within(sidebar).findAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(9);

        for (const title of PAGE_TITLES) {
            within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title });
        }
    });

    it("binds the GtkStackSidebar to the stack", async () => {
        await renderDemo(sidebarDemo);
        const sidebar = await findSidebar();
        const stack = await findStack();
        expect(sidebar).toHaveObjectProperty("stack", stack);
    });

    it("uses a 256px decorated icon for the welcome page only", async () => {
        await renderDemo(sidebarDemo);
        const stack = await findStack();
        const images = await within(stack).findAllByRole(Gtk.AccessibleRole.IMG, { as: Gtk.Image });
        expect(images).toHaveLength(1);
        const [image] = images;

        if (!image) {
            throw new Error("expected a welcome-page image");
        }

        expect(image).toHaveObjectProperty("pixelSize", 256);
        expect(image).toHaveClass("icon-dropshadow");
    });

    it("uses a plain GtkLabel for non-welcome pages", async () => {
        await renderDemo(sidebarDemo);
        const stack = await findStack();
        const label = await within(stack).findByRole(Gtk.AccessibleRole.LABEL, { name: "Scrolling" });
        expect(label).toBeInstanceOf(Gtk.Label);
    });
});

describe("sidebarDemo navigation", () => {
    it("switches the stack to the page whose sidebar row is activated", async () => {
        await renderDemo(sidebarDemo);
        const sidebar = await findSidebar();
        const stack = await findStack();
        expect(stack).toHaveObjectProperty("visibleChildName", "Welcome to GTK");
        within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Welcome to GTK", selected: true });
        await userEvent.click(within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Scrolling" }));

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "Scrolling");
        });

        within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Scrolling", selected: true });
        await userEvent.click(within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Page 9" }));

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "Page 9");
        });

        await userEvent.click(within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Welcome to GTK" }));

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "Welcome to GTK");
        });
    });

    it("reflects programmatic stack changes back through the sidebar row selection", async () => {
        await renderDemo(sidebarDemo);
        const stack = await findStack();
        const sidebar = await findSidebar();

        await act(() => {
            stack.setVisibleChildName("Page 7");
        });

        await waitFor(() => {
            expect(
                within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Page 7", selected: true }),
            ).not.toBeNull();
        },
        );
    });
});
