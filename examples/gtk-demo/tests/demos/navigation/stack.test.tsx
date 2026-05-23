import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { stackDemo } from "../../../src/demos/navigation/stack.js";
import { renderDemo, screen } from "../../test-utils.js";

const findStack = async (): Promise<Gtk.Stack> => {
    const switcher = (await screen.findByRole(Gtk.AccessibleRole.TAB_LIST)) as Gtk.StackSwitcher;
    const stack = switcher.getStack();
    if (!(stack instanceof Gtk.Stack)) throw new Error("expected switcher to be bound to a Stack");
    return stack;
};

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
        expect(switcher.getStack()).toBeInstanceOf(Gtk.Stack);
    });
});

describe("stackDemo pages", () => {
    it("declares pages with the expected titles and ids", async () => {
        await renderDemo(stackDemo);
        const stack = await findStack();

        const page1Child = stack.getChildByName("page1");
        const page2Child = stack.getChildByName("page2");
        const page3Child = stack.getChildByName("page3");

        if (!page1Child || !page2Child || !page3Child) throw new Error("stack pages missing");

        expect(stack.getPage(page1Child).getTitle()).toBe("Page 1");
        expect(stack.getPage(page2Child).getTitle()).toBe("Page 2");
        expect(stack.getPage(page3Child).getIconName()).toBe("face-laugh-symbolic");
    });

    it("renders the Page 2 check button inside the stack", async () => {
        await renderDemo(stackDemo);
        const stack = await findStack();
        const page2Child = stack.getChildByName("page2");
        expect(page2Child).toBeInstanceOf(Gtk.CheckButton);
        expect((page2Child as Gtk.CheckButton).getLabel()).toBe("Page 2");
    });
});
