import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { overlayDecorativeDemo } from "../../../src/demos/layout/overlay-decorative.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const matches: T[] = [];
    const visit = (widget: Gtk.Widget): void => {
        if (widget instanceof ctor) matches.push(widget);
        let child = widget.getFirstChild();
        while (child) {
            visit(child);
            child = child.getNextSibling();
        }
    };
    visit(root);
    return matches;
};

describe("overlayDecorativeDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(overlayDecorativeDemo.id).toBe("overlay-decorative");
        expect(overlayDecorativeDemo.title).toBe("Overlay/Decorative Overlay");
        expect(overlayDecorativeDemo.description.length).toBeGreaterThan(0);
        expect(overlayDecorativeDemo.keywords).toEqual(
            expect.arrayContaining([
                "overlay",
                "badge",
                "ribbon",
                "watermark",
                "notification",
                "decorative",
                "layer",
                "GtkOverlay",
            ]),
        );
        expect(typeof overlayDecorativeDemo.sourceCode).toBe("string");
        expect(overlayDecorativeDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(overlayDecorativeDemo.defaultWidth).toBe(500);
        expect(overlayDecorativeDemo.defaultHeight).toBe(510);
        expect(overlayDecorativeDemo.component).toBeTypeOf("function");
    });
});

describe("overlayDecorativeDemo overlay structure", () => {
    it("renders a single GtkOverlay containing the scrolled text view and three overlay children", async () => {
        if (!overlayDecorativeDemo.component) throw new Error("overlay-decorative demo component missing");
        const { container } = await renderDemo(overlayDecorativeDemo.component);
        const overlays = findAllOfType(container, Gtk.Overlay);
        expect(overlays).toHaveLength(1);
        const scrolledWindows = findAllOfType(container, Gtk.ScrolledWindow);
        expect(scrolledWindows).toHaveLength(1);
        const textViews = findAllOfType(container, Gtk.TextView);
        expect(textViews).toHaveLength(1);
        const pictures = findAllOfType(container, Gtk.Picture);
        expect(pictures).toHaveLength(2);
        const scales = findAllOfType(container, Gtk.Scale);
        expect(scales).toHaveLength(1);
    });

    it("configures the scrolled window with automatic scrollbar policies", async () => {
        if (!overlayDecorativeDemo.component) throw new Error("overlay-decorative demo component missing");
        const { container } = await renderDemo(overlayDecorativeDemo.component);
        const [scrolled] = findAllOfType(container, Gtk.ScrolledWindow);
        if (!scrolled) throw new Error("expected scrolled window");
        const [hpolicy, vpolicy] = scrolled.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("aligns the decorative pictures at opposite corners and prevents pointer targeting", async () => {
        if (!overlayDecorativeDemo.component) throw new Error("overlay-decorative demo component missing");
        const { container } = await renderDemo(overlayDecorativeDemo.component);
        const pictures = findAllOfType(container, Gtk.Picture);
        expect(pictures).toHaveLength(2);
        const [first, second] = pictures;
        if (!first || !second) throw new Error("expected two pictures");
        expect(first.getHalign()).toBe(Gtk.Align.START);
        expect(first.getValign()).toBe(Gtk.Align.START);
        expect(first.getCanTarget()).toBe(false);
        expect(second.getHalign()).toBe(Gtk.Align.END);
        expect(second.getValign()).toBe(Gtk.Align.END);
        expect(second.getCanTarget()).toBe(false);
    });
});

describe("overlayDecorativeDemo scale behavior", () => {
    it("initialises the scale at 100 with a 0..100 range and step of 1", async () => {
        if (!overlayDecorativeDemo.component) throw new Error("overlay-decorative demo component missing");
        const { container } = await renderDemo(overlayDecorativeDemo.component);
        const [scale] = findAllOfType(container, Gtk.Scale);
        if (!scale) throw new Error("expected Gtk.Scale");
        const adjustment = scale.getAdjustment();
        expect(adjustment.getValue()).toBe(100);
        expect(adjustment.getLower()).toBe(0);
        expect(adjustment.getUpper()).toBe(100);
        expect(adjustment.getStepIncrement()).toBe(1);
        expect(scale.getDrawValue()).toBe(false);
        const [width] = scale.getSizeRequest();
        expect(width).toBe(120);
        expect(scale.getTooltipText()).toBe("Margin");
    });

    it("syncs the TextView left margin when the scale value changes", async () => {
        if (!overlayDecorativeDemo.component) throw new Error("overlay-decorative demo component missing");
        const { container } = await renderDemo(overlayDecorativeDemo.component);
        const [scale] = findAllOfType(container, Gtk.Scale);
        const [textView] = findAllOfType(container, Gtk.TextView);
        if (!scale || !textView) throw new Error("expected scale and text view");
        expect(textView.getLeftMargin()).toBe(100);
        const adjustment = scale.getAdjustment();
        await act(() => adjustment.setValue(25));
        await fireEvent(scale, "value-changed");
        expect(textView.getLeftMargin()).toBe(25);
    });

    it("rounds non-integer margins from the scale value", async () => {
        if (!overlayDecorativeDemo.component) throw new Error("overlay-decorative demo component missing");
        const { container } = await renderDemo(overlayDecorativeDemo.component);
        const [scale] = findAllOfType(container, Gtk.Scale);
        const [textView] = findAllOfType(container, Gtk.TextView);
        if (!scale || !textView) throw new Error("expected scale and text view");
        const adjustment = scale.getAdjustment();
        await act(() => adjustment.setValue(37.7));
        await fireEvent(scale, "value-changed");
        expect(textView.getLeftMargin()).toBe(38);
    });
});

describe("overlayDecorativeDemo text content", () => {
    it("renders the 'Dear diary...' text inside the text view buffer", async () => {
        if (!overlayDecorativeDemo.component) throw new Error("overlay-decorative demo component missing");
        const { container } = await renderDemo(overlayDecorativeDemo.component);
        const [textView] = findAllOfType(container, Gtk.TextView);
        if (!textView) throw new Error("expected text view");
        const buffer = textView.getBuffer();
        const start = buffer.getStartIter();
        const end = buffer.getEndIter();
        const text = buffer.getText(start, end, false);
        expect(text).toContain("Dear");
        expect(text).toContain("diary");
    });
});
