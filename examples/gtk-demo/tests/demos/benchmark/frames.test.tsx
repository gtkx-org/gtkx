import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { framesDemo } from "../../../src/demos/benchmark/frames.js";
import { renderDemo } from "../../helpers/render-demo.js";

describe("framesDemo", () => {
    it("exposes the expected metadata", () => {
        expect(framesDemo.id).toBe("frames");
        expect(framesDemo.title).toBe("Benchmark/Frames");
        expect(framesDemo.defaultWidth).toBe(600);
        expect(framesDemo.defaultHeight).toBe(400);
        expect(typeof framesDemo.sourceCode).toBe("string");
    });

    it("renders an fps label in the header bar driven by shared state", async () => {
        const { window } = await renderDemo(framesDemo);
        const win = window.current;
        if (!win) throw new Error("expected the window ref to be populated");
        const titlebar = win.getTitlebar?.();
        if (!titlebar) throw new Error("titlebar missing");
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
        const collectLabels = (root: Gtk.Widget, out: Gtk.Label[] = []): Gtk.Label[] => {
            if (root instanceof Gtk.Label) out.push(root);
            let child = root.getFirstChild();
            while (child) {
                collectLabels(child, out);
                child = child.getNextSibling();
            }
            return out;
        };
        const fpsLabel = collectLabels(titlebar).find((l) => /fps$/.test(l.getLabel() ?? ""));
        if (!fpsLabel) throw new Error("expected an fps label inside the titlebar");
        expect(fpsLabel.getLabel()).toMatch(/^[0-9]+\.[0-9]{2} fps$/);
    });

    it("renders the drawing area in the body", async () => {
        const { container } = await renderDemo(framesDemo);
        const findDrawingArea = (root: Gtk.Widget): Gtk.DrawingArea | null => {
            if (root instanceof Gtk.DrawingArea) return root;
            let child = root.getFirstChild();
            while (child) {
                const found = findDrawingArea(child);
                if (found) return found;
                child = child.getNextSibling();
            }
            return null;
        };
        const drawingArea = findDrawingArea(container);
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
        expect(drawingArea?.getHexpand()).toBe(true);
        expect(drawingArea?.getVexpand()).toBe(true);
    });

    it("resizes the host window to 600x400 when mounted", async () => {
        const { window } = await renderDemo(framesDemo);
        const win = window.current;
        if (!win) throw new Error("expected the window ref to be populated");
        const [width, height] = win.getDefaultSize();
        expect(width).toBe(600);
        expect(height).toBe(400);
    });
});
