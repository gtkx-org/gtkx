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

describe("stackDemo structure", () => {
    it("renders three named stack switcher tabs", async () => {
        await renderDemo(stackDemo);
        await screen.findByRole(Gtk.AccessibleRole.TAB_LIST, { name: "Stack pages", as: Gtk.StackSwitcher });
        expect(await screen.findAllByRole(Gtk.AccessibleRole.TAB)).toHaveLength(3);
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Page 1" });
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Page 2" });
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Page 3" });
    });

    it("uses crossfade as the stack transition", async () => {
        const stack = await renderStack();
        expect(stack).toHaveObjectProperty("transitionType", Gtk.StackTransitionType.CROSSFADE);
    });
});

describe("stackDemo pages", () => {
    it("shows the named GTK Demo logo on the first page", async () => {
        await renderStack();
        const logo = await screen.findByRole(Gtk.AccessibleRole.IMG, { name: "GTK Demo logo", as: Gtk.Image });
        expect(logo).toBeVisible();
    });

    it("renders the Page 2 check button inside the stack", async () => {
        const stack = await renderStack();
        expect(within(stack).queryByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Page 2" })).toBeNull();
        await clickTab("Page 2");
        const checkButton = await within(stack).findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Page 2" });
        expect(checkButton).toBeVisible();
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
        await clickTab("Page 3");

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "page3");
        });

        const spinner = await within(stack).findByRole(Gtk.AccessibleRole.PROGRESS_BAR, {
            name: "Loading Page 3",
            as: Gtk.Spinner,
        });
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
