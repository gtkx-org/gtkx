import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { markupDemo } from "../../../src/demos/advanced/markup.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

const readBufferText = (tv: Gtk.TextView): string => {
    const buf = tv.getBuffer();
    return buf.getText(buf.getStartIter(), buf.getEndIter(), false) ?? "";
};

const findTextViewPair = async (): Promise<{ source: Gtk.TextView; formatted: Gtk.TextView }> => {
    const views = (await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView[];
    if (views.length !== 2) throw new Error(`expected exactly 2 GtkTextView widgets, got ${views.length}`);
    const source = views.find((v) => v.getEditable());
    const formatted = views.find((v) => !v.getEditable());
    if (!source || !formatted) throw new Error("expected one editable and one read-only text view");
    return { source, formatted };
};

const getVisibleStackChildName = async (): Promise<string | undefined> => {
    const { source } = await findTextViewPair();
    let parent: Gtk.Widget | null = source;
    while (parent && !(parent instanceof Gtk.Stack)) parent = parent.getParent();
    return (parent as Gtk.Stack | null)?.getVisibleChildName() ?? undefined;
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
        const visible = await getVisibleStackChildName();
        expect(visible).toBe("formatted");
    });

    it("populates the source text view buffer with the markup content", async () => {
        await renderDemo(markupDemo);
        const { source } = await findTextViewPair();
        const text = readBufferText(source);
        expect(text.length).toBeGreaterThan(0);
    });

    it("populates the formatted view by inserting markup into its buffer", async () => {
        await renderDemo(markupDemo);
        const { formatted } = await findTextViewPair();
        const text = readBufferText(formatted);
        expect(text.length).toBeGreaterThan(0);
    });
});

describe("markupDemo toggle interaction", () => {
    it("switches to the source page when the Source toggle is activated", async () => {
        await renderDemo(markupDemo);
        const sourceToggle = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Source",
        })) as Gtk.CheckButton;

        await act(() => sourceToggle.setActive(true));
        await fireEvent(sourceToggle, "toggled");

        const visible = await getVisibleStackChildName();
        expect(visible).toBe("source");
    });

    it("re-applies the markup when toggling Source back off after editing", async () => {
        await renderDemo(markupDemo);
        const sourceToggle = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Source",
        })) as Gtk.CheckButton;

        await act(() => sourceToggle.setActive(true));
        await fireEvent(sourceToggle, "toggled");

        const { source, formatted } = await findTextViewPair();
        const buffer = source.getBuffer();
        await act(() => buffer.setText("Hello <b>World</b>", -1));

        await act(() => sourceToggle.setActive(false));
        await fireEvent(sourceToggle, "toggled");

        const visible = await getVisibleStackChildName();
        expect(visible).toBe("formatted");
        const formattedText = readBufferText(formatted);
        expect(formattedText).toContain("Hello");
        expect(formattedText).toContain("World");
    });
});
