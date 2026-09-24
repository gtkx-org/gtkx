import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { overlayDecorativeDemo } from "../../../src/demos/layout/overlay-decorative.js";
import { renderDemo } from "../../test-utils.js";

type MarginTargets = { scale: Gtk.Scale; textView: Gtk.TextView };

const renderMarginTargets = async (): Promise<MarginTargets> => {
    await renderDemo(overlayDecorativeDemo, { isReactStrictMode: true });
    const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name: "Text margin", as: Gtk.Scale });
    const textView = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Diary", as: Gtk.TextView });

    return { scale, textView };
};

const textPosition = (textView: Gtk.TextView): { x: number; y: number } => {
    const location = textView.getIterLocation(textView.getBuffer().getStartIter());

    return { x: location.x, y: location.y };
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
        expect(first.getAccessibleRole()).toBe(Gtk.AccessibleRole.PRESENTATION);
        expect(second).toHaveObjectProperty("halign", Gtk.Align.END);
        expect(second).toHaveObjectProperty("valign", Gtk.Align.END);
        expect(second).toHaveObjectProperty("canTarget", false);
        expect(second.getAccessibleRole()).toBe(Gtk.AccessibleRole.PRESENTATION);
    });
});

describe("overlayDecorativeDemo scale behavior", () => {
    it("initialises the scale at 100 with a 0..100 range and step of 1", async () => {
        await renderDemo(overlayDecorativeDemo);
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, {
            name: "Text margin",
            value: { now: 100, min: 0, max: 100 },
            as: Gtk.Scale,
        });
        const adjustment = scale.getAdjustment();
        expect(adjustment).toHaveObjectProperty("stepIncrement", 1);
        expect(scale).toHaveObjectProperty("drawValue", false);
        const [width] = scale.getSizeRequest();
        expect(width).toBe(120);
        expect(scale).toHaveObjectProperty("tooltipText", "Margin");
    });

    it("moves the rendered diary text toward the top-left as the margin decreases", async () => {
        const { scale, textView } = await renderMarginTargets();
        expect(textPosition(textView)).toEqual({ x: 100, y: 100 });
        await userEvent.slide(scale, 25);

        await waitFor(() => {
            expect(textPosition(textView)).toEqual({ x: 25, y: 25 });
        });
    });

    it("rounds non-integer slider positions in the rendered text geometry", async () => {
        const { scale, textView } = await renderMarginTargets();
        await userEvent.slide(scale, 37.7);

        await waitFor(() => {
            expect(textPosition(textView)).toEqual({ x: 38, y: 38 });
        });
    });
});

describe("overlayDecorativeDemo text content", () => {
    it("renders the concatenated 'Dear diary...' text inside the text view buffer", async () => {
        await renderDemo(overlayDecorativeDemo);

        expect(await screen.findByDisplayValue(/Dear diary\.\.\./)).toBe(
            await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Diary", as: Gtk.TextView }),
        );
    });
});
