import * as Gtk from "@gtkx/gi/gtk";
import { screen, screenshot } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { textmaskDemo } from "../../../src/demos/advanced/textmask.js";
import { renderDemo, screenshotColors } from "../../test-utils.js";

describe("textmaskDemo rendering", () => {
    it("applies the configured default size to the host window", async () => {
        await renderDemo(textmaskDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        const [width, height] = window.getDefaultSize();
        expect(width).toBe(400);
        expect(height).toBe(240);
    });

    it("mounts the GtkDrawingArea as the sole content of the host window", async () => {
        await renderDemo(textmaskDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        const drawingArea = await screen.findByName("textmask-area", { as: Gtk.DrawingArea });
        expect(drawingArea).toBeRooted();
        expect(window).toContainElement(drawingArea);
        expect(drawingArea).toBeEmptyWidget();
    });
});

describe("textmaskDemo paint", () => {
    it("paints visible content into the drawing area", async () => {
        await renderDemo(textmaskDemo);
        const drawingArea = await screen.findByName("textmask-area", { as: Gtk.DrawingArea });
        const image = await screenshot(drawingArea);
        expect(screenshotColors(image).size).toBeGreaterThan(16);
    });
});
