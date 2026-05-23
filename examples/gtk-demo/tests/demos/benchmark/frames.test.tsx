import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { framesDemo } from "../../../src/demos/benchmark/frames.js";
import { renderDemo, screen } from "../../test-utils.js";

describe("framesDemo", () => {
    it("exposes the expected metadata", () => {
        expect(framesDemo.id).toBe("frames");
        expect(framesDemo.title).toBe("Benchmark/Frames");
        expect(framesDemo.defaultWidth).toBe(600);
        expect(framesDemo.defaultHeight).toBe(400);
        expect(typeof framesDemo.sourceCode).toBe("string");
    });

    it("renders the fps label in the header bar driven by shared state", async () => {
        const { window } = await renderDemo(framesDemo);
        const win = window.current;
        if (!win) throw new Error("expected the window ref to be populated");
        const titlebar = win.getTitlebar?.();
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
        const fpsContainer = await screen.findByText(/^[0-9]+\.[0-9]{2} fps$/);
        expect(fpsContainer).toBeDefined();
    });

    it("renders the snapshot color widget in the body", async () => {
        const { window } = await renderDemo(framesDemo);
        const win = window.current;
        if (!win) throw new Error("expected the window ref to be populated");
        const body = win.getChild();
        if (!body) throw new Error("window body missing");
        const colorWidget = body.getFirstChild();
        if (!colorWidget) throw new Error("expected the color widget inside the body box");
        expect(colorWidget.getHexpand()).toBe(true);
        expect(colorWidget.getVexpand()).toBe(true);
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
