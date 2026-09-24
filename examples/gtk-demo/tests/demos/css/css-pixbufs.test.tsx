import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssPixbufsDemo } from "../../../src/demos/css/css-pixbufs.js";
import { renderDemo } from "../../test-utils.js";

describe("cssPixbufsDemo", () => {
    it("renders the animated background preview and CSS editor", async () => {
        await renderDemo(cssPixbufsDemo);
        const preview = await screen.findByRole(Gtk.AccessibleRole.IMG, {
            name: "Animated CSS background preview",
        });
        const editor = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "CSS editor" });
        expect(preview).toBeVisible();
        expect(editor).toBeVisible();
    });

    it("preloads the default CSS containing the keyframe animations", async () => {
        await renderDemo(cssPixbufsDemo);
        const textView = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "CSS editor",
            as: Gtk.TextView,
        });
        expect(textView).toHaveDisplayValue(/@keyframes move-the-image/);
        expect(textView).toHaveDisplayValue(/@keyframes size-the-image/);
        expect(textView).toHaveDisplayValue(/animation: move-the-image/);
    });

    it("applies the demo class to the host window", async () => {
        await renderDemo(cssPixbufsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
    });
});
