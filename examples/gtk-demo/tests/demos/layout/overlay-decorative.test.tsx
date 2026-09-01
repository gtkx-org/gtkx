import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { overlayDecorativeDemo } from "../../../src/demos/layout/overlay-decorative.js";
import { renderDemo } from "../../test-utils.js";

type MarginTargets = { scale: Gtk.Scale; textView: Gtk.TextView; topMarginTag: Gtk.TextTag };

const renderMarginTargets = async (): Promise<MarginTargets> => {
    await renderDemo(overlayDecorativeDemo);
    const scale = await screen.findByName("margin-scale", { as: Gtk.Scale });
    const textView = await screen.findByName("text-view", { as: Gtk.TextView });

    return { scale, textView, topMarginTag: textView.getBuffer().getTagTable().lookup("top-margin") as Gtk.TextTag };
};

describe("overlayDecorativeDemo overlay structure", () => {
    it("renders a single GtkOverlay containing the scrolled text view and three overlay children", async () => {
        await renderDemo(overlayDecorativeDemo);
        const overlay = await screen.findByName("overlay", { as: Gtk.Overlay });
        const scrolled = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        expect(screen.getAllByName("overlay")).toHaveLength(1);
        expect(overlay).toContainElement(scrolled);
        expect(scrolled).toContainElement(await screen.findByName("text-view", { as: Gtk.TextView }));
        expect(overlay).toContainElement(await screen.findByName("picture-start", { as: Gtk.Picture }));
        expect(overlay).toContainElement(await screen.findByName("picture-end", { as: Gtk.Picture }));
        expect(overlay).toContainElement(await screen.findByName("margin-scale", { as: Gtk.Scale }));
    });

    it("configures the scrolled window with automatic scrollbar policies", async () => {
        await renderDemo(overlayDecorativeDemo);
        const scrolled = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const [hpolicy, vpolicy] = scrolled.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("aligns the decorative pictures at opposite corners and prevents pointer targeting", async () => {
        await renderDemo(overlayDecorativeDemo);
        const first = await screen.findByName("picture-start", { as: Gtk.Picture });
        const second = await screen.findByName("picture-end", { as: Gtk.Picture });
        expect(first).toHaveObjectProperty("halign", Gtk.Align.START);
        expect(first).toHaveObjectProperty("valign", Gtk.Align.START);
        expect(first).toHaveObjectProperty("canTarget", false);
        expect(second).toHaveObjectProperty("halign", Gtk.Align.END);
        expect(second).toHaveObjectProperty("valign", Gtk.Align.END);
        expect(second).toHaveObjectProperty("canTarget", false);
    });
});

describe("overlayDecorativeDemo scale behavior", () => {
    it("initialises the scale at 100 with a 0..100 range and step of 1", async () => {
        await renderDemo(overlayDecorativeDemo);
        const scale = await screen.findByName("margin-scale", { as: Gtk.Scale });
        await screen.findByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 100, min: 0, max: 100 } });
        const adjustment = scale.getAdjustment();
        expect(adjustment).toHaveObjectProperty("stepIncrement", 1);
        expect(scale).toHaveObjectProperty("drawValue", false);
        const [width] = scale.getSizeRequest();
        expect(width).toBe(120);
        expect(scale).toHaveObjectProperty("tooltipText", "Margin");
    });

    it("syncs the TextView left margin and top-margin tag when the scale value changes", async () => {
        const { scale, textView, topMarginTag } = await renderMarginTargets();
        expect(textView).toHaveObjectProperty("leftMargin", 100);
        expect(topMarginTag).toHaveObjectProperty("pixelsAboveLines", 100);
        await userEvent.slide(scale, 25);
        expect(textView).toHaveObjectProperty("leftMargin", 25);
        expect(topMarginTag).toHaveObjectProperty("pixelsAboveLines", 25);
    });

    it("rounds non-integer margins for both the left margin and the top-margin tag", async () => {
        const { scale, textView, topMarginTag } = await renderMarginTargets();
        await userEvent.slide(scale, 37.7);
        expect(textView).toHaveObjectProperty("leftMargin", 38);
        expect(topMarginTag).toHaveObjectProperty("pixelsAboveLines", 38);
    });
});

describe("overlayDecorativeDemo text content", () => {
    it("renders the concatenated 'Dear diary...' text inside the text view buffer", async () => {
        await renderDemo(overlayDecorativeDemo);

        expect(await screen.findByDisplayValue(/Dear diary\.\.\./)).toBe(
            await screen.findByName("text-view", { as: Gtk.TextView }),
        );
    });
});
