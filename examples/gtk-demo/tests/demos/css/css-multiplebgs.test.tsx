import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { cssMultiplebgsDemo } from "../../../src/demos/css/css-multiplebgs.js";
import { renderDemo, screen } from "../../test-utils.js";

describe("cssMultiplebgsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(cssMultiplebgsDemo.id).toBe("css-multiplebgs");
        expect(cssMultiplebgsDemo.title).toBe("Theming/Multiple Backgrounds");
        expect(cssMultiplebgsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(cssMultiplebgsDemo.keywords)).toBe(true);
        expect(typeof cssMultiplebgsDemo.sourceCode).toBe("string");
        expect(cssMultiplebgsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssMultiplebgsDemo.defaultWidth).toBe(400);
        expect(cssMultiplebgsDemo.defaultHeight).toBe(300);
        expect(cssMultiplebgsDemo.component).toBeTypeOf("function");
    });

    it("renders an overlay with a drawing area canvas", async () => {
        await renderDemo(cssMultiplebgsDemo);
        const overlay = await screen.findByName("overlay");
        expect(overlay).toBeInstanceOf(Gtk.Overlay);
        const drawingArea = (await screen.findByName("canvas")) as Gtk.DrawingArea;
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
        expect(drawingArea.getHexpand()).toBe(true);
        expect(drawingArea.getVexpand()).toBe(true);
    });

    it("renders the named bricks button overlay child", async () => {
        await renderDemo(cssMultiplebgsDemo);
        const bricksButton = (await screen.findByName("bricks-button")) as Gtk.Button;
        expect(bricksButton).toBeInstanceOf(Gtk.Button);
    });

    it("renders a vertical paned editor with the default CSS loaded in the buffer", async () => {
        await renderDemo(cssMultiplebgsDemo);
        const paned = (await screen.findByName("paned")) as Gtk.Paned;
        expect(paned).toBeInstanceOf(Gtk.Paned);
        expect(paned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("#canvas");
        expect(text).toContain("transition-property");
    });

    it("adds the demo window class on mount and removes it on unmount", async () => {
        const { window, unmount } = await renderDemo(cssMultiplebgsDemo);
        const win = window.current;
        expect(win).not.toBeNull();
        if (!win) return;
        expect(win.hasCssClass("demo")).toBe(true);
        await unmount();
        expect(win.hasCssClass("demo")).toBe(false);
    });
});
