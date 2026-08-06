import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { stackDemo } from "../../../src/demos/navigation/stack.js";
import { renderDemo } from "../../test-utils.js";

const findStack = async (): Promise<Gtk.Stack> => screen.findByName("stack", { as: Gtk.Stack });

const renderStack = async (): Promise<Gtk.Stack> => {
    await renderDemo(stackDemo);

    return await findStack();
};

const clickTab = async (name: string): Promise<void> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name }));
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
        expect(await screen.findAllByRole(Gtk.AccessibleRole.TAB)).toHaveLength(3);
    });

    it("renders a GtkStackSwitcher tied to the stack", async () => {
        await renderDemo(stackDemo);
        const switcher = await screen.findByRole(Gtk.AccessibleRole.TAB_LIST, { as: Gtk.StackSwitcher });
        expect(switcher).toBeInstanceOf(Gtk.StackSwitcher);
        const stack = await findStack();
        expect(switcher).toHaveObjectProperty("stack", stack);
    });

    it("uses crossfade as the stack transition", async () => {
        const stack = await renderStack();
        expect(stack).toHaveObjectProperty("transitionType", Gtk.StackTransitionType.CROSSFADE);
    });
});

describe("stackDemo pages", () => {
    it("declares pages with the expected titles and ids", async () => {
        const stack = await renderStack();
        const page1Child = stack.getChildByName("page1");
        const page2Child = stack.getChildByName("page2");
        const page3Child = stack.getChildByName("page3");
        expect(page1Child).toBeInstanceOf(Gtk.Image);
        expect(page2Child).toBeInstanceOf(Gtk.CheckButton);
        expect(page3Child).toBeInstanceOf(Gtk.Spinner);
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Page 1" });
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Page 2" });

        if (!page3Child) {
            throw new Error("expected page3 child");
        }

        expect(stack.getPage(page3Child)).toHaveObjectProperty("iconName", "face-laugh-symbolic");
    });

    it("renders the Page 2 check button inside the stack", async () => {
        const stack = await renderStack();
        expect(within(stack).queryByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Page 2" })).toBeNull();
        await clickTab("Page 2");
        const checkButton = await within(stack).findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Page 2" });
        expect(checkButton).toBeInstanceOf(Gtk.CheckButton);
    });
});

describe("stackDemo switching", () => {
    it("starts with the first page visible", async () => {
        const stack = await renderStack();
        expect(stack).toHaveObjectProperty("visibleChildName", "page1");
    });

    it("changes the visible page when a different switcher tab is clicked", async () => {
        const stack = await renderStack();
        await clickTab("Page 2");

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "page2");
        });

        expect(stack.getVisibleChild()).toBeInstanceOf(Gtk.CheckButton);
        const tabs = await screen.findAllByRole(Gtk.AccessibleRole.TAB);
        const page3Tab = tabs[2];

        if (!page3Tab) {
            throw new Error("expected a third stack switcher tab");
        }

        await userEvent.click(page3Tab);

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "page3");
        });

        const spinner = stack.getVisibleChild();
        expect(spinner).toBeInstanceOf(Gtk.Spinner);
        expect(spinner).toHaveObjectProperty("spinning", true);
    });
});

describe("stackDemo page interaction", () => {
    it("returns to the first page when the Page 1 tab is clicked", async () => {
        const stack = await renderStack();
        await clickTab("Page 2");

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "page2");
        });

        await clickTab("Page 1");

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "page1");
        });

        expect(stack.getVisibleChild()).toBeInstanceOf(Gtk.Image);
    });

    it("activates the Page 2 check button via userEvent.click", async () => {
        const stack = await renderStack();
        await clickTab("Page 2");
        const checkButton = await within(stack).findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Page 2" });
        expect(within(stack).queryByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Page 2", checked: true })).toBeNull();
        await userEvent.click(checkButton);

        await waitFor(() => {
            expect(
                within(stack).queryByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Page 2", checked: true }),
            ).not.toBeNull();
        },
        );
    });
});
