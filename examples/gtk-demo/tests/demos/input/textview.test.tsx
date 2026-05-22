import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { textviewDemo } from "../../../src/demos/input/textview.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllByType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new () => T): T[] => {
    const results: T[] = [];
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof ctor) results.push(node as T);
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return results;
};

const findFirstByType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new () => T): T | null => {
    const [first] = findAllByType(root, ctor);
    return first ?? null;
};

const readBufferText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();
    return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false) ?? "";
};

describe("textviewDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(textviewDemo.id).toBe("textview");
        expect(textviewDemo.title).toBe("Text View/Multiple Views");
        expect(typeof textviewDemo.sourceCode).toBe("string");
        expect(textviewDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(textviewDemo.defaultWidth).toBe(450);
        expect(textviewDemo.defaultHeight).toBe(450);
        expect(textviewDemo.component).toBeTypeOf("function");
    });
});

describe("textviewDemo rendering", () => {
    it("renders a vertical paned with two text views sharing a single buffer", async () => {
        const { container } = await renderDemo(textviewDemo);
        const paned = findFirstByType(container, Gtk.Paned);
        expect(paned).toBeInstanceOf(Gtk.Paned);
        expect(paned?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        const textViews = findAllByType(container, Gtk.TextView);
        expect(textViews).toHaveLength(2);
        const [view1, view2] = textViews;
        if (!view1 || !view2) throw new Error("expected two text views");
        expect(view1).toBeInstanceOf(Gtk.TextView);
        expect(view2).toBeInstanceOf(Gtk.TextView);
        expect(view1.getBuffer()).toBe(view2.getBuffer());
    });

    it("populates the shared buffer with section headings and international content", async () => {
        const { container } = await renderDemo(textviewDemo);
        const textView = findFirstByType(container, Gtk.TextView) as Gtk.TextView;
        const text = readBufferText(textView);
        expect(text).toContain("The text widget can display text with all kinds of nifty attributes");
        expect(text).toContain("Font styles.");
        expect(text).toContain("Colors.");
        expect(text).toContain("Underline, strikethrough, and rise.");
        expect(text).toContain("Images.");
        expect(text).toContain("Spacing.");
        expect(text).toContain("Editability.");
        expect(text).toContain("Wrapping.");
        expect(text).toContain("Justification.");
        expect(text).toContain("Internationalization.");
        expect(text).toContain("Grüß Gott");
        expect(text).toContain("Γειά σας");
    });

    it("wraps text in word mode in the first text view", async () => {
        const { container } = await renderDemo(textviewDemo);
        const textViews = findAllByType(container, Gtk.TextView);
        const view1 = textViews[0];
        if (!view1) throw new Error("expected first text view");
        expect(view1.getWrapMode()).toBe(Gtk.WrapMode.WORD);
    });
});

describe("textviewDemo cloned widgets", () => {
    it("attaches Click Me buttons, drop downs, scales, and entries in the second text view", async () => {
        const { container } = await renderDemo(textviewDemo);
        const textViews = findAllByType(container, Gtk.TextView);
        const view2 = textViews[1];
        if (!view2) throw new Error("expected second text view");
        const buttonsInView2 = findAllByType(view2, Gtk.Button).filter((b) => b.getLabel() === "Click Me");
        expect(buttonsInView2.length).toBeGreaterThanOrEqual(1);
        const dropDownsInView2 = findAllByType(view2, Gtk.DropDown);
        expect(dropDownsInView2.length).toBeGreaterThanOrEqual(1);
        const scalesInView2 = findAllByType(view2, Gtk.Scale);
        expect(scalesInView2.length).toBeGreaterThanOrEqual(1);
        const entriesInView2 = findAllByType(view2, Gtk.Entry);
        expect(entriesInView2.length).toBeGreaterThanOrEqual(1);
    });
});

describe("textviewDemo easter egg", () => {
    it("opens the easter-egg nested window when the cloned Click Me button is activated", async () => {
        const { container } = await renderDemo(textviewDemo);
        const textViews = findAllByType(container, Gtk.TextView);
        const view2 = textViews[1];
        if (!view2) throw new Error("expected second text view");
        const clonedButton = findAllByType(view2, Gtk.Button).find((b) => b.getLabel() === "Click Me");
        if (!clonedButton) throw new Error("expected cloned Click Me button");
        const beforeWindows = Gtk.Window.listToplevels().length;
        await fireEvent(clonedButton, "clicked");
        await waitFor(() => {
            expect(Gtk.Window.listToplevels().length).toBeGreaterThan(beforeWindows);
        });
    });

    it("opens the easter-egg via the source Click Me button in the first text view", async () => {
        const { container } = await renderDemo(textviewDemo);
        const textViews = findAllByType(container, Gtk.TextView);
        const view1 = textViews[0];
        if (!view1) throw new Error("expected first text view");
        const sourceButton = findAllByType(view1, Gtk.Button).find((b) => b.getLabel() === "Click Me");
        if (!sourceButton) throw new Error("expected source Click Me button");
        const beforeWindows = Gtk.Window.listToplevels().length;
        await fireEvent(sourceButton, "clicked");
        await waitFor(() => {
            expect(Gtk.Window.listToplevels().length).toBeGreaterThanOrEqual(beforeWindows);
        });
    });

    it("reuses the same easter-egg window on subsequent activations", async () => {
        const { container } = await renderDemo(textviewDemo);
        const textViews = findAllByType(container, Gtk.TextView);
        const view2 = textViews[1];
        if (!view2) throw new Error("expected second text view");
        const clonedButton = findAllByType(view2, Gtk.Button).find((b) => b.getLabel() === "Click Me");
        if (!clonedButton) throw new Error("expected cloned Click Me button");
        const beforeWindows = Gtk.Window.listToplevels().length;
        await fireEvent(clonedButton, "clicked");
        const windowCountAfterFirst = await waitFor(() => {
            const count = Gtk.Window.listToplevels().length;
            expect(count).toBeGreaterThan(beforeWindows);
            return count;
        });
        await fireEvent(clonedButton, "clicked");
        await waitFor(() => {
            expect(Gtk.Window.listToplevels().length).toBe(windowCountAfterFirst);
        });
    });
});
