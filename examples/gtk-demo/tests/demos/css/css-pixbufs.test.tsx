import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssPixbufsDemo } from "../../../src/demos/css/css-pixbufs.js";
import { renderDemo } from "../../test-utils.js";

describe("cssPixbufsDemo", () => {
    it("renders a vertical paned holding the scrolled text view editor as its end child", async () => {
        await renderDemo(cssPixbufsDemo);
        const paned = await screen.findByName("paned", { as: Gtk.Paned });
        expect(paned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(paned.getStartChild()).toBeEmptyWidget();
        expect(paned.getEndChild()).toBe(await screen.findByName("scrolled"));
    });

    it("preloads the default CSS containing the keyframe animations", async () => {
        await renderDemo(cssPixbufsDemo);
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        expect(textView).toHaveDisplayValue(/@keyframes move-the-image/);
        expect(textView).toHaveDisplayValue(/@keyframes size-the-image/);
        expect(textView).toHaveDisplayValue(/animation: move-the-image/);
    });

    it("declares the demo window class on the host window", async () => {
        expect(cssPixbufsDemo.windowCssClasses).toEqual(["demo"]);
        await renderDemo(cssPixbufsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
    });
});
