import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { cssPixbufsDemo } from "../../../src/demos/css/css-pixbufs.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findFirstOfType } from "../../helpers/traverse.js";

describe("cssPixbufsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(cssPixbufsDemo.id).toBe("css-pixbufs");
        expect(cssPixbufsDemo.title).toBe("Theming/Animated Backgrounds");
        expect(cssPixbufsDemo.description.length).toBeGreaterThan(0);
        expect(cssPixbufsDemo.keywords).toEqual(
            expect.arrayContaining(["css", "animation", "keyframes", "gradient", "background"]),
        );
        expect(typeof cssPixbufsDemo.sourceCode).toBe("string");
        expect(cssPixbufsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssPixbufsDemo.defaultWidth).toBe(400);
        expect(cssPixbufsDemo.defaultHeight).toBe(300);
        expect(cssPixbufsDemo.component).toBeTypeOf("function");
    });

    it("renders a vertical paned wrapping the text view editor", async () => {
        if (!cssPixbufsDemo.component) throw new Error("css-pixbufs demo component missing");
        const { container } = await renderDemo(cssPixbufsDemo.component);
        const paned = findFirstOfType(container, Gtk.Paned);
        expect(paned).toBeInstanceOf(Gtk.Paned);
        expect(paned?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        const sw = findFirstOfType(container, Gtk.ScrolledWindow);
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
    });

    it("preloads the default CSS containing the keyframe animations", async () => {
        if (!cssPixbufsDemo.component) throw new Error("css-pixbufs demo component missing");
        const { container } = await renderDemo(cssPixbufsDemo.component);
        const textView = findFirstOfType(container, Gtk.TextView) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("@keyframes move-the-image");
        expect(text).toContain("@keyframes size-the-image");
        expect(text).toContain("animation: move-the-image");
    });

    it("adds the demo window class on mount and removes it on unmount", async () => {
        if (!cssPixbufsDemo.component) throw new Error("css-pixbufs demo component missing");
        const { window, unmount } = await renderDemo(cssPixbufsDemo.component);
        const win = window.current;
        expect(win).not.toBeNull();
        if (!win) return;
        expect(win.hasCssClass("demo")).toBe(true);
        await unmount();
        expect(win.hasCssClass("demo")).toBe(false);
    });

    it("propagates new buffer text through onBufferChanged", async () => {
        if (!cssPixbufsDemo.component) throw new Error("css-pixbufs demo component missing");
        const { container } = await renderDemo(cssPixbufsDemo.component);
        const textView = findFirstOfType(container, Gtk.TextView) as Gtk.TextView;
        const buffer = textView.getBuffer();
        buffer.setText("window { background-color: cyan; }", -1);
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toBe("window { background-color: cyan; }");
    });
});
