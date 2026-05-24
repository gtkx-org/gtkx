import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssPixbufsDemo } from "../../../src/demos/css/css-pixbufs.js";
import { renderDemo } from "../../test-utils.js";

describe("cssPixbufsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(cssPixbufsDemo.id).toBe("css-pixbufs");
        expect(cssPixbufsDemo.title).toBe("Theming/Animated Backgrounds");
        expect(cssPixbufsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(cssPixbufsDemo.keywords)).toBe(true);
        expect(typeof cssPixbufsDemo.sourceCode).toBe("string");
        expect(cssPixbufsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssPixbufsDemo.defaultWidth).toBe(400);
        expect(cssPixbufsDemo.defaultHeight).toBe(300);
        expect(cssPixbufsDemo.component).toBeTypeOf("function");
    });

    it("renders a vertical paned wrapping the text view editor", async () => {
        await renderDemo(cssPixbufsDemo);
        const paned = (await screen.findByName("paned")) as Gtk.Paned;
        expect(paned).toBeInstanceOf(Gtk.Paned);
        expect(paned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        const sw = await screen.findByName("scrolled");
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
    });

    it("preloads the default CSS containing the keyframe animations", async () => {
        await renderDemo(cssPixbufsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("@keyframes move-the-image");
        expect(text).toContain("@keyframes size-the-image");
        expect(text).toContain("animation: move-the-image");
    });

    it("declares the demo window class on the host window", async () => {
        expect(cssPixbufsDemo.windowCssClasses).toEqual(["demo"]);
        await renderDemo(cssPixbufsDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        expect(window.hasCssClass("demo")).toBe(true);
    });

    it("propagates new buffer text through onBufferChanged", async () => {
        await renderDemo(cssPixbufsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        const buffer = textView.getBuffer();
        buffer.setText("window { background-color: cyan; }", -1);
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toBe("window { background-color: cyan; }");
    });
});
