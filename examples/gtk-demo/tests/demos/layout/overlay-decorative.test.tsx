import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { overlayDecorativeDemo } from "../../../src/demos/layout/overlay-decorative.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

describe("overlayDecorativeDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(overlayDecorativeDemo.id).toBe("overlay-decorative");
        expect(overlayDecorativeDemo.title).toBe("Overlay/Decorative Overlay");
        expect(overlayDecorativeDemo.description.length).toBeGreaterThan(0);
        expect(overlayDecorativeDemo.keywords).toEqual(["GtkOverlay"]);
        expect(typeof overlayDecorativeDemo.sourceCode).toBe("string");
        expect(overlayDecorativeDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(overlayDecorativeDemo.defaultWidth).toBe(500);
        expect(overlayDecorativeDemo.defaultHeight).toBe(510);
        expect(overlayDecorativeDemo.component).toBeTypeOf("function");
    });
});

describe("overlayDecorativeDemo overlay structure", () => {
    it("renders a single GtkOverlay containing the scrolled text view and three overlay children", async () => {
        await renderDemo(overlayDecorativeDemo);
        expect(await screen.findByName("overlay")).toBeInstanceOf(Gtk.Overlay);
        expect(await screen.findByName("scrolled")).toBeInstanceOf(Gtk.ScrolledWindow);
        expect(await screen.findByName("text-view")).toBeInstanceOf(Gtk.TextView);
        expect(await screen.findByName("picture-start")).toBeInstanceOf(Gtk.Picture);
        expect(await screen.findByName("picture-end")).toBeInstanceOf(Gtk.Picture);
        expect(await screen.findByName("margin-scale")).toBeInstanceOf(Gtk.Scale);
    });

    it("configures the scrolled window with automatic scrollbar policies", async () => {
        await renderDemo(overlayDecorativeDemo);
        const scrolled = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        const [hpolicy, vpolicy] = scrolled.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("aligns the decorative pictures at opposite corners and prevents pointer targeting", async () => {
        await renderDemo(overlayDecorativeDemo);
        const first = (await screen.findByName("picture-start")) as Gtk.Picture;
        const second = (await screen.findByName("picture-end")) as Gtk.Picture;
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
        await renderDemo(overlayDecorativeDemo);
        const scale = (await screen.findByName("margin-scale")) as Gtk.Scale;
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
        await renderDemo(overlayDecorativeDemo);
        const scale = (await screen.findByName("margin-scale")) as Gtk.Scale;
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        expect(textView.getLeftMargin()).toBe(100);
        const adjustment = scale.getAdjustment();
        await act(() => adjustment.setValue(25));
        await fireEvent(scale, "value-changed");
        expect(textView.getLeftMargin()).toBe(25);
    });

    it("rounds non-integer margins from the scale value", async () => {
        await renderDemo(overlayDecorativeDemo);
        const scale = (await screen.findByName("margin-scale")) as Gtk.Scale;
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        const adjustment = scale.getAdjustment();
        await act(() => adjustment.setValue(37.7));
        await fireEvent(scale, "value-changed");
        expect(textView.getLeftMargin()).toBe(38);
    });
});

describe("overlayDecorativeDemo text content", () => {
    it("renders the 'Dear diary...' text inside the text view buffer", async () => {
        await renderDemo(overlayDecorativeDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const start = buffer.getStartIter();
        const end = buffer.getEndIter();
        const text = buffer.getText(start, end, false);
        expect(text).toContain("Dear");
        expect(text).toContain("diary");
    });
});
