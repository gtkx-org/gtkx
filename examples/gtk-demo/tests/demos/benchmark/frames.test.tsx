import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { framesDemo } from "../../../src/demos/benchmark/frames.js";
import { renderDemo } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

const findFpsLabel = (header: Gtk.HeaderBar): Gtk.Label =>
    within(header).getByRole(Gtk.AccessibleRole.LABEL, { name: /^[0-9]+\.[0-9]{2} fps$/ }) as Gtk.Label;

describe("framesDemo", () => {
    it("exposes the expected metadata", () => {
        expect(framesDemo.id).toBe("frames");
        expect(framesDemo.title).toBe("Benchmark/Frames");
        expect(framesDemo.defaultWidth).toBe(600);
        expect(framesDemo.defaultHeight).toBe(400);
        expect(typeof framesDemo.sourceCode).toBe("string");
    });

    it("renders the fps label in the header bar driven by shared state", async () => {
        await renderDemo(framesDemo);
        const header = (await screen.findByName("frames-header")) as Gtk.HeaderBar;
        expect(header).toBeInstanceOf(Gtk.HeaderBar);
        await within(header).findByRole(Gtk.AccessibleRole.LABEL, {
            name: /^[0-9]+\.[0-9]{2} fps$/,
        });
    });

    it("carries a tabular-numbers font-features Pango attribute on the fps label", async () => {
        await renderDemo(framesDemo);
        const header = (await screen.findByName("frames-header")) as Gtk.HeaderBar;
        const fpsLabel = findFpsLabel(header);
        const attrs = fpsLabel.getAttributes();
        if (!attrs) throw new Error("fps label has no Pango attribute list");
        const features: string[] = [];
        const iterator = attrs.getIterator();
        let hasMore = true;
        while (hasMore) {
            for (const attr of iterator.getAttrs()) {
                const fontFeatures = attr.asFontFeatures();
                if (fontFeatures) features.push(fontFeatures.features);
            }
            hasMore = iterator.next();
        }
        expect(features).toContain("tnum=1");
    });

    it("instantiates the custom snapshot subclass and lets it fill its parent box", async () => {
        await renderDemo(framesDemo);
        const colorWidget = await screen.findByName("color-widget");
        expect(GObject.typeName(colorWidget.__type__)).toBe("GtkxFramesColorWidget");
        const box = colorWidget.getParent() as Gtk.Box;
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(colorWidget.getWidth()).toBeGreaterThan(0);
        expect(colorWidget.getHeight()).toBeGreaterThan(0);
        expect(colorWidget.getWidth()).toBe(box.getWidth());
        expect(colorWidget.getHeight()).toBe(box.getHeight());
    });

    it("drives the fps poller off the frame clock so the header label leaves 0.00 fps", async () => {
        await renderDemo(framesDemo);
        const colorWidget = await screen.findByName("color-widget");
        expect(colorWidget.getFrameClock()).not.toBeNull();
        const header = (await screen.findByName("frames-header")) as Gtk.HeaderBar;
        expect(findFpsLabel(header).getLabel()).toBe("0.00 fps");
        await waitFor(
            () => {
                expect(findFpsLabel(header).getLabel()).not.toBe("0.00 fps");
            },
            { timeout: 10000 },
        );
        expect(findFpsLabel(header).getLabel()).toMatch(/^[0-9]+\.[0-9]{2} fps$/);
    });

    it("realizes the host window at the demo's 600x400 default size", async () => {
        await renderDemo(framesDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        expect(window.getWidth()).toBe(600);
        expect(window.getHeight()).toBe(400);
    });
});
