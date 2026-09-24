import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssMultiplebgsDemo } from "../../../src/demos/css/css-multiplebgs.js";
import { renderDemo } from "../../test-utils.js";

describe("cssMultiplebgsDemo", () => {
    it("renders the background preview, bricks control, and CSS editor", async () => {
        await renderDemo(cssMultiplebgsDemo);
        await screen.findByRole(Gtk.AccessibleRole.IMG, { name: "CSS background preview" });
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Bricks" });
        const textView = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "CSS editor",
            as: Gtk.TextView,
        });
        expect(textView).toHaveDisplayValue(/#canvas/);
        expect(textView).toHaveDisplayValue(/transition-property/);
    });

    it("applies the demo class to the host window", async () => {
        await renderDemo(cssMultiplebgsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
    });
});
