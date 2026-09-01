import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssMultiplebgsDemo } from "../../../src/demos/css/css-multiplebgs.js";
import { renderDemo } from "../../test-utils.js";

describe("cssMultiplebgsDemo", () => {
    it("renders an overlay with a canvas drawing area and the bricks button", async () => {
        await renderDemo(cssMultiplebgsDemo);
        const overlay = await screen.findByName("overlay", { as: Gtk.Overlay });
        const canvas = await screen.findByName("canvas", { as: Gtk.DrawingArea });
        const bricksButton = await screen.findByName("bricks-button", { as: Gtk.Button });
        expect(overlay.getChild()).toBe(canvas);
        expect(overlay).toContainElement(bricksButton);
        expect(canvas).toHaveObjectProperty("hexpand", true);
        expect(canvas).toHaveObjectProperty("vexpand", true);
    });

    it("splits the editor from the canvas with a vertical paned holding the editor as its end child", async () => {
        await renderDemo(cssMultiplebgsDemo);
        const paned = await screen.findByName("paned", { as: Gtk.Paned });
        expect(paned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(paned.getStartChild()).toBeEmptyWidget();
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        expect(paned.getEndChild()).toContainElement(textView);
        expect(textView).toHaveDisplayValue(/#canvas/);
        expect(textView).toHaveDisplayValue(/transition-property/);
    });

    it("declares the demo window class on the host window", async () => {
        expect(cssMultiplebgsDemo.windowCssClasses).toEqual(["demo"]);
        await renderDemo(cssMultiplebgsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
    });
});
