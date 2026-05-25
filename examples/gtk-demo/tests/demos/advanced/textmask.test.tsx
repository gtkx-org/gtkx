import * as Gtk from "@gtkx/ffi/gtk";
import { act, screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { textmaskDemo } from "../../../src/demos/advanced/textmask.js";
import { renderDemo } from "../../test-utils.js";

describe("textmaskDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(textmaskDemo.id).toBe("textmask");
        expect(textmaskDemo.title).toBe("Pango/Text Mask");
        expect(textmaskDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(textmaskDemo.keywords)).toBe(true);
        expect(typeof textmaskDemo.sourceCode).toBe("string");
        expect(textmaskDemo.defaultWidth).toBe(400);
        expect(textmaskDemo.defaultHeight).toBe(240);
        expect(textmaskDemo.keywords).toEqual([]);
    });

    it("provides source code that references PangoCairo and a linear gradient", () => {
        const source = textmaskDemo.sourceCode ?? "";
        expect(source).toContain("PangoCairo");
        expect(source).toContain("createLinear");
    });
});

describe("textmaskDemo rendering", () => {
    it("applies the configured default size to the host window", async () => {
        await renderDemo(textmaskDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        const [width, height] = window.getDefaultSize();
        expect(width).toBe(400);
        expect(height).toBe(240);
    });

    it("renders a GtkDrawingArea with the demo's draw function attached", async () => {
        await renderDemo(textmaskDemo);
        const drawingArea = await screen.findByName("textmask-area");
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });
});

describe("textmaskDemo paint", () => {
    it("attaches a draw function to the drawing area", async () => {
        const setDrawFunc = vi.spyOn(Gtk.DrawingArea.prototype, "setDrawFunc");
        try {
            await renderDemo(textmaskDemo);
            await screen.findByName("textmask-area");
            const drawFuncCall = setDrawFunc.mock.calls.find(([fn]) => typeof fn === "function");
            expect(drawFuncCall).toBeDefined();
        } finally {
            setDrawFunc.mockRestore();
        }
    });

    it("retains the configured content size after queueDraw", async () => {
        await renderDemo(textmaskDemo);
        const drawingArea = (await screen.findByName("textmask-area")) as Gtk.DrawingArea;
        await act(() => {
            drawingArea.setContentWidth(400);
            drawingArea.setContentHeight(240);
            drawingArea.queueDraw();
        });
        expect(drawingArea.getContentWidth()).toBe(400);
        expect(drawingArea.getContentHeight()).toBe(240);
    });
});
