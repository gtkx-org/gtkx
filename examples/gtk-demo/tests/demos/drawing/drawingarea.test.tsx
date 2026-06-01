import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { drawingAreaDemo } from "../../../src/demos/drawing/drawingarea.js";
import { renderDemo } from "../../test-utils.js";

describe("drawingAreaDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(drawingAreaDemo.id).toBe("drawingarea");
        expect(drawingAreaDemo.title).toBe("Drawing Area");
        expect(drawingAreaDemo.description.length).toBeGreaterThan(0);
        expect(drawingAreaDemo.keywords).toEqual(expect.arrayContaining(["GtkDrawingArea"]));
        expect(typeof drawingAreaDemo.sourceCode).toBe("string");
        expect(drawingAreaDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(drawingAreaDemo.defaultWidth).toBe(250);
        expect(drawingAreaDemo.component).toBeTypeOf("function");
    });

    it("populates the host window reference on mount", async () => {
        await renderDemo(drawingAreaDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW);
        expect(window).toBeInstanceOf(Gtk.Window);
    });
});

describe("drawingAreaDemo rendering", () => {
    it("renders both the knockout-groups heading and the scribble-area heading", async () => {
        await renderDemo(drawingAreaDemo);
        const knockout = (await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: "Knockout groups" })) as Gtk.Label;
        const scribble = (await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: "Scribble area" })) as Gtk.Label;
        expect(knockout).toBeInstanceOf(Gtk.Label);
        expect(scribble).toBeInstanceOf(Gtk.Label);
        expect(knockout.hasCssClass("heading")).toBe(true);
        expect(scribble.hasCssClass("heading")).toBe(true);
    });

    it("renders two GtkDrawingArea widgets each sized 100x100", async () => {
        await renderDemo(drawingAreaDemo);
        const knockout = (await screen.findByName("knockout-area")) as Gtk.DrawingArea;
        const scribble = (await screen.findByName("scribble-area")) as Gtk.DrawingArea;
        for (const area of [knockout, scribble]) {
            expect(area.getContentWidth()).toBe(100);
            expect(area.getContentHeight()).toBe(100);
            expect(area.getAccessibleRole()).toBe(Gtk.AccessibleRole.IMG);
        }
    });

    it("wraps each drawing area in a vertical-expanding frame", async () => {
        await renderDemo(drawingAreaDemo);
        const knockoutFrame = (await screen.findByName("knockout-frame")) as Gtk.Frame;
        const scribbleFrame = (await screen.findByName("scribble-frame")) as Gtk.Frame;
        for (const frame of [knockoutFrame, scribbleFrame]) {
            expect(frame).toBeInstanceOf(Gtk.Frame);
            expect(frame.getVexpand()).toBe(true);
        }
        expect(within(knockoutFrame).getByName("knockout-area")).toBeInstanceOf(Gtk.DrawingArea);
        expect(within(scribbleFrame).getByName("scribble-area")).toBeInstanceOf(Gtk.DrawingArea);
    });
});

describe("drawingAreaDemo gestures", () => {
    it("queues a redraw on the scribble area after a drag gesture initialises the scribble surface", async () => {
        await renderDemo(drawingAreaDemo);
        const scribble = (await screen.findByName("scribble-area")) as Gtk.DrawingArea;
        await fireEvent(scribble, "resize", 100, 100);
        const queueDraw = vi.spyOn(scribble, "queueDraw");
        await userEvent.drag(scribble, 5, 5, { startX: 10, startY: 10 });
        expect(queueDraw).toHaveBeenCalled();
        expect(scribble.getContentWidth()).toBe(100);
    });
});
