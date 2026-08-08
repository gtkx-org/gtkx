import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { expanderDemo } from "../../../src/demos/buttons/expander.js";
import { renderDemo } from "../../test-utils.js";

const renderExpander = async (): Promise<Gtk.Expander> => {
    await renderDemo(expanderDemo);

    return await screen.findByName("expander", { as: Gtk.Expander });
};

describe("expanderDemo", () => {
    it("exposes the expected metadata", () => {
        expect(expanderDemo.id).toBe("expander");
        expect(expanderDemo.title).toBe("Expander");
        expect(typeof expanderDemo.sourceCode).toBe("string");
    });

    it("renders the headline label, the details summary, and the collapsed Details expander", async () => {
        await renderDemo(expanderDemo);

        await screen.findByRole(Gtk.AccessibleRole.LABEL, {
            name: "Here are some more details but not the full story",
        });

        const expander = await screen.findByName("expander", { as: Gtk.Expander });
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Details:", expanded: false })).toBe(expander);
        expect(expander).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, false);
    });

    it("flips its own expanded state to true when clicked", async () => {
        const expander = await renderExpander();
        expect(expander).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, false);
        await userEvent.click(expander);

        await waitFor(() => {
            expect(expander).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, true);
        });

        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Details:", expanded: true })).toBe(expander);
    });

    it("encloses a non-editable, word-wrapped TextView seeded with the details paragraph", async () => {
        const expander = await renderExpander();
        await userEvent.click(expander);
        const textView = await within(expander).findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
        expect(textView).toBeInstanceOf(Gtk.TextView);
        expect(textView).toHaveObjectProperty("editable", false);
        expect(textView).toHaveObjectProperty("wrapMode", Gtk.WrapMode.WORD);
        expect(screen.getByDisplayValue(/Finally, the full story/)).toBe(textView);
    });

    it("makes the host window resizable when the expander is expanded", async () => {
        await renderDemo(expanderDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        const expander = await screen.findByName("expander", { as: Gtk.Expander });
        window.setResizable(false);
        await userEvent.click(expander);

        await waitFor(() => {
            expect(window).toHaveObjectProperty("resizable", true);
        });

        await userEvent.click(expander);

        await waitFor(() => {
            expect(window).toHaveObjectProperty("resizable", false);
        });
    });
});
