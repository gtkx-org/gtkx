import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { markupDemo } from "../../../src/demos/advanced/markup.js";
import { readBufferText, renderDemo } from "../../test-utils.js";

const clickSourceToggle = async (): Promise<Gtk.CheckButton> => {
    const sourceToggle = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
        name: "Source",
        as: Gtk.CheckButton,
    });

    await userEvent.click(sourceToggle);

    return sourceToggle;
};

describe("markupDemo initial state", () => {
    it("renders the 'Source' toggle that controls the visible stack page", async () => {
        await renderDemo(markupDemo);
        const toggle = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Source", checked: false });
        expect(toggle).toBeRooted();
        expect(toggle).toHaveAccessibleName("Source");
        expect(toggle).not.toBeChecked();
    });

    it("starts with the 'formatted' stack page visible", async () => {
        await renderDemo(markupDemo);
        const stack = await screen.findByName("markup-stack", { as: Gtk.Stack });
        expect(stack).toHaveObjectProperty("visibleChildName", "formatted");
    });

    it("populates the source text view buffer with the raw markup content", async () => {
        await renderDemo(markupDemo);
        await clickSourceToggle();
        const source = await screen.findByName("source-view", { as: Gtk.TextView });
        expect(source).toHaveDisplayValue(/Text sizes:/);
        expect(source).toHaveDisplayValue(/<span size="xx-small">/);
    });

    it("populates the formatted view with parsed markup, stripping the raw span tags", async () => {
        await renderDemo(markupDemo);
        const formatted = await screen.findByName("formatted-view", { as: Gtk.TextView });
        expect(formatted).toHaveDisplayValue(/Text sizes:/);
        const formattedText = readBufferText(formatted);
        expect(formattedText).not.toContain("<span");
        expect(formattedText).toContain("Letterspacing");
    });
});

describe("markupDemo toggle interaction", () => {
    it("switches to the source page when the Source toggle is activated", async () => {
        await renderDemo(markupDemo);
        await clickSourceToggle();
        const stack = await screen.findByName("markup-stack", { as: Gtk.Stack });
        expect(stack).toHaveObjectProperty("visibleChildName", "source");
    });

    it("re-applies the markup when toggling Source back off after editing", async () => {
        await renderDemo(markupDemo);
        const sourceToggle = await clickSourceToggle();
        const source = await screen.findByName("source-view", { as: Gtk.TextView });
        await userEvent.clear(source);
        await userEvent.type(source, "Hello <b>World</b>");
        await userEvent.click(sourceToggle);
        const formatted = await screen.findByName("formatted-view", { as: Gtk.TextView });
        const stack = await screen.findByName("markup-stack", { as: Gtk.Stack });
        expect(stack).toHaveObjectProperty("visibleChildName", "formatted");
        expect(formatted).toHaveDisplayValue(/Hello/);
        expect(formatted).toHaveDisplayValue(/World/);
    });
});
