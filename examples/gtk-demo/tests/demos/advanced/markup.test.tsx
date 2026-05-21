import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { markupDemo } from "../../../src/demos/advanced/markup.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const collectTextViews = (root: Gtk.Widget, out: Gtk.TextView[] = []): Gtk.TextView[] => {
    if (root instanceof Gtk.TextView) out.push(root);
    let child = root.getFirstChild();
    while (child) {
        collectTextViews(child, out);
        child = child.getNextSibling();
    }
    return out;
};

const findStack = (root: Gtk.Widget): Gtk.Stack | null => {
    if (root instanceof Gtk.Stack) return root;
    let child = root.getFirstChild();
    while (child) {
        const found = findStack(child);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

const readBufferText = (tv: Gtk.TextView): string => {
    const buf = tv.getBuffer();
    return buf.getText(buf.getStartIter(), buf.getEndIter(), false) ?? "";
};

describe("markupDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(markupDemo, { id: "markup", title: "Text View/Markup" });
        expect(typeof markupDemo.sourceCode).toBe("string");
        expect(markupDemo.defaultWidth).toBe(600);
        expect(markupDemo.defaultHeight).toBe(680);
        expect(markupDemo.keywords).toContain("pango");
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
        const { container } = await renderDemo(markupDemo);
        const stack = findStack(container);
        expect(stack?.getVisibleChildName()).toBe("formatted");
    });

    it("populates the source text view buffer with the markup content", async () => {
        const { container } = await renderDemo(markupDemo);
        const textViews = collectTextViews(container);
        expect(textViews).toHaveLength(2);

        const editableViews = textViews.filter((tv) => tv.getEditable());
        const sourceView = editableViews[0];
        if (!sourceView) throw new Error("source view not found");

        const text = readBufferText(sourceView);
        expect(text.length).toBeGreaterThan(0);
    });

    it("populates the formatted view by inserting markup into its buffer", async () => {
        const { container } = await renderDemo(markupDemo);
        const textViews = collectTextViews(container);
        const formattedView = textViews.find((tv) => !tv.getEditable());
        if (!formattedView) throw new Error("formatted view not found");

        const text = readBufferText(formattedView);
        expect(text.length).toBeGreaterThan(0);
    });
});

describe("markupDemo toggle interaction", () => {
    it("switches to the source page when the Source toggle is activated", async () => {
        const { container } = await renderDemo(markupDemo);
        const sourceToggle = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Source",
        })) as Gtk.CheckButton;

        await act(() => sourceToggle.setActive(true));
        await fireEvent(sourceToggle, "toggled");

        const stack = findStack(container);
        expect(stack?.getVisibleChildName()).toBe("source");
    });

    it("re-applies the markup when toggling Source back off after editing", async () => {
        const { container } = await renderDemo(markupDemo);
        const sourceToggle = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Source",
        })) as Gtk.CheckButton;

        await act(() => sourceToggle.setActive(true));
        await fireEvent(sourceToggle, "toggled");

        const textViews = collectTextViews(container);
        const sourceView = textViews.find((tv) => tv.getEditable());
        if (!sourceView) throw new Error("source view not found");
        const buffer = sourceView.getBuffer();
        await act(() => buffer.setText("Hello <b>World</b>", -1));

        await act(() => sourceToggle.setActive(false));
        await fireEvent(sourceToggle, "toggled");

        const stack = findStack(container);
        expect(stack?.getVisibleChildName()).toBe("formatted");
        const formattedView = textViews.find((tv) => !tv.getEditable());
        if (!formattedView) throw new Error("formatted view not found");
        const formattedText = readBufferText(formattedView);
        expect(formattedText).toContain("Hello");
        expect(formattedText).toContain("World");
    });
});
