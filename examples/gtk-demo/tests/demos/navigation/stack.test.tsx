import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { stackDemo } from "../../../src/demos/navigation/stack.js";
import { renderDemo } from "../../test-utils.js";

const findStack = async (): Promise<Gtk.Stack> => (await screen.findByName("stack")) as Gtk.Stack;

describe("stackDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(stackDemo.id).toBe("stack");
        expect(stackDemo.title).toBe("Stack");
        expect(stackDemo.description.length).toBeGreaterThan(0);
        expect(typeof stackDemo.sourceCode).toBe("string");
        expect(Array.isArray(stackDemo.keywords)).toBe(true);
    });
});

describe("stackDemo structure", () => {
    it("renders a GtkStack containing three pages", async () => {
        await renderDemo(stackDemo);
        const stack = await findStack();
        expect(stack.getPages().getNItems()).toBe(3);
    });

    it("renders a GtkStackSwitcher tied to the stack", async () => {
        await renderDemo(stackDemo);
        const switcher = (await screen.findByRole(Gtk.AccessibleRole.TAB_LIST)) as Gtk.StackSwitcher;
        expect(switcher).toBeInstanceOf(Gtk.StackSwitcher);
        const stack = await findStack();
        expect(switcher.getStack()).toBe(stack);
    });
});

describe("stackDemo pages", () => {
    it("declares pages with the expected titles and ids", async () => {
        await renderDemo(stackDemo);
        const stack = await findStack();

        const page1Child = stack.getChildByName("page1");
        const page2Child = stack.getChildByName("page2");
        const page3Child = stack.getChildByName("page3");

        expect(page1Child).toBeInstanceOf(Gtk.Widget);
        expect(page2Child).toBeInstanceOf(Gtk.Widget);
        expect(page3Child).toBeInstanceOf(Gtk.Widget);

        expect(stack.getPage(page1Child as Gtk.Widget).getTitle()).toBe("Page 1");
        expect(stack.getPage(page2Child as Gtk.Widget).getTitle()).toBe("Page 2");
        expect(stack.getPage(page3Child as Gtk.Widget).getIconName()).toBe("face-laugh-symbolic");
    });

    it("renders the Page 2 check button inside the stack", async () => {
        await renderDemo(stackDemo);
        const stack = await findStack();
        const page2Child = stack.getChildByName("page2");
        expect(page2Child).toBeInstanceOf(Gtk.CheckButton);
        expect((page2Child as Gtk.CheckButton).getLabel()).toBe("Page 2");
    });
});
