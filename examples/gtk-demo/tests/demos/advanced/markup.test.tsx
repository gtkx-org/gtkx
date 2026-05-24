import * as Gtk from "@gtkx/ffi/gtk";
import { act, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { markupDemo } from "../../../src/demos/advanced/markup.js";
import { renderDemo } from "../../test-utils.js";

const readBufferText = (tv: Gtk.TextView): string => {
    const buf = tv.getBuffer();
    return buf.getText(buf.getStartIter(), buf.getEndIter(), false) ?? "";
};

describe("markupDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(markupDemo.id).toBe("markup");
        expect(markupDemo.title).toBe("Text View/Markup");
        expect(markupDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(markupDemo.keywords)).toBe(true);
        expect(typeof markupDemo.sourceCode).toBe("string");
        expect(markupDemo.defaultWidth).toBe(600);
        expect(markupDemo.defaultHeight).toBe(680);
        expect(markupDemo.keywords).toContain("GtkTextView");
    });
});

describe("markupDemo initial state", () => {
    it("renders the 'Source' toggle that controls the visible stack page", async () => {
        await renderDemo(markupDemo);
        const sourceToggle = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Source",
        })) as Gtk.CheckButton;
        expect(sourceToggle.getActive()).toBe(false);
    });

    it("starts with the 'formatted' stack page visible", async () => {
        await renderDemo(markupDemo);
        const stack = (await screen.findByName("markup-stack")) as Gtk.Stack;
        expect(stack.getVisibleChildName()).toBe("formatted");
    });

    it("populates the source text view buffer with the markup content", async () => {
        await renderDemo(markupDemo);
        const source = (await screen.findByName("source-view")) as Gtk.TextView;
        expect(readBufferText(source).length).toBeGreaterThan(0);
    });

    it("populates the formatted view by inserting markup into its buffer", async () => {
        await renderDemo(markupDemo);
        const formatted = (await screen.findByName("formatted-view")) as Gtk.TextView;
        expect(readBufferText(formatted).length).toBeGreaterThan(0);
    });
});

describe("markupDemo toggle interaction", () => {
    it("switches to the source page when the Source toggle is activated", async () => {
        await renderDemo(markupDemo);
        const sourceToggle = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Source",
        })) as Gtk.CheckButton;

        await userEvent.click(sourceToggle);

        const stack = (await screen.findByName("markup-stack")) as Gtk.Stack;
        expect(stack.getVisibleChildName()).toBe("source");
    });

    it("re-applies the markup when toggling Source back off after editing", async () => {
        await renderDemo(markupDemo);
        const sourceToggle = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Source",
        })) as Gtk.CheckButton;

        await userEvent.click(sourceToggle);

        const source = (await screen.findByName("source-view")) as Gtk.TextView;
        const formatted = (await screen.findByName("formatted-view")) as Gtk.TextView;
        const buffer = source.getBuffer();
        await act(() => buffer.setText("Hello <b>World</b>", -1));

        await userEvent.click(sourceToggle);

        const stack = (await screen.findByName("markup-stack")) as Gtk.Stack;
        expect(stack.getVisibleChildName()).toBe("formatted");
        const formattedText = readBufferText(formatted);
        expect(formattedText).toContain("Hello");
        expect(formattedText).toContain("World");
    });
});
