import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { cssMultiplebgsDemo } from "../../../src/demos/css/css-multiplebgs.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType, findFirstOfType } from "../../helpers/traverse.js";

describe("cssMultiplebgsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(cssMultiplebgsDemo.id).toBe("css-multiplebgs");
        expect(cssMultiplebgsDemo.title).toBe("Theming/Multiple Backgrounds");
        expect(cssMultiplebgsDemo.description.length).toBeGreaterThan(0);
        expect(cssMultiplebgsDemo.keywords).toEqual(
            expect.arrayContaining(["css", "background", "gradient", "layers", "multiple"]),
        );
        expect(typeof cssMultiplebgsDemo.sourceCode).toBe("string");
        expect(cssMultiplebgsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssMultiplebgsDemo.defaultWidth).toBe(400);
        expect(cssMultiplebgsDemo.defaultHeight).toBe(300);
        expect(cssMultiplebgsDemo.component).toBeTypeOf("function");
    });

    it("renders an overlay with a drawing area canvas", async () => {
        if (!cssMultiplebgsDemo.component) throw new Error("css-multiplebgs demo component missing");
        const { container } = await renderDemo(cssMultiplebgsDemo.component);
        const overlay = findFirstOfType(container, Gtk.Overlay);
        expect(overlay).toBeInstanceOf(Gtk.Overlay);
        const drawingArea = findFirstOfType(container, Gtk.DrawingArea);
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
        expect(drawingArea?.getHexpand()).toBe(true);
        expect(drawingArea?.getVexpand()).toBe(true);
    });

    it("renders at least one GtkButton as an overlay child", async () => {
        if (!cssMultiplebgsDemo.component) throw new Error("css-multiplebgs demo component missing");
        const { container } = await renderDemo(cssMultiplebgsDemo.component);
        const buttons = findAllOfType(container, Gtk.Button);
        expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("renders a vertical paned editor with the default CSS loaded in the buffer", async () => {
        if (!cssMultiplebgsDemo.component) throw new Error("css-multiplebgs demo component missing");
        const { container } = await renderDemo(cssMultiplebgsDemo.component);
        const paned = findFirstOfType(container, Gtk.Paned);
        expect(paned).toBeInstanceOf(Gtk.Paned);
        expect(paned?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        const textView = findFirstOfType(container, Gtk.TextView) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("#canvas");
        expect(text).toContain("transition-property");
    });

    it("adds the demo window class on mount and removes it on unmount", async () => {
        if (!cssMultiplebgsDemo.component) throw new Error("css-multiplebgs demo component missing");
        const { window, unmount } = await renderDemo(cssMultiplebgsDemo.component);
        const win = window.current;
        expect(win).not.toBeNull();
        if (!win) return;
        expect(win.hasCssClass("demo")).toBe(true);
        await unmount();
        expect(win.hasCssClass("demo")).toBe(false);
    });
});
