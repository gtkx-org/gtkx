import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { drawingAreaDemo } from "../../../src/demos/drawing/drawingarea.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { collectControllers, findAllOfType } from "../../helpers/traverse.js";

describe("drawingAreaDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(drawingAreaDemo.id).toBe("drawingarea");
        expect(drawingAreaDemo.title).toBe("Drawing Area");
        expect(drawingAreaDemo.description.length).toBeGreaterThan(0);
        expect(drawingAreaDemo.keywords).toEqual(expect.arrayContaining(["gtkdrawingarea"]));
        expect(typeof drawingAreaDemo.sourceCode).toBe("string");
        expect(drawingAreaDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(drawingAreaDemo.defaultWidth).toBe(250);
        expect(drawingAreaDemo.component).toBeTypeOf("function");
    });

    it("populates the host window reference on mount", async () => {
        const { window } = await renderDemo(drawingAreaDemo);
        const win = window.current;
        expect(win).not.toBeNull();
        expect(win).toBeInstanceOf(Gtk.Window);
    });
});

describe("drawingAreaDemo rendering", () => {
    it("renders both the knockout-groups heading and the scribble-area heading", async () => {
        const { container } = await renderDemo(drawingAreaDemo);
        const labels = findAllOfType(container, Gtk.Label);
        const knockout = labels.find((l) => l.getLabel() === "Knockout groups");
        const scribble = labels.find((l) => l.getLabel() === "Scribble area");
        expect(knockout).toBeInstanceOf(Gtk.Label);
        expect(scribble).toBeInstanceOf(Gtk.Label);
        expect(knockout?.hasCssClass("heading")).toBe(true);
        expect(scribble?.hasCssClass("heading")).toBe(true);
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

    it("wraps each drawing area in a frame stretching vertically", async () => {
        const { container } = await renderDemo(drawingAreaDemo);
        const frames = findAllOfType(container, Gtk.Frame);
        expect(frames.length).toBeGreaterThanOrEqual(2);
        for (const frame of frames) {
            expect(frame.getVexpand()).toBe(true);
        }
    });
});

describe("drawingAreaDemo gestures", () => {
    it("attaches a GtkGestureDrag controller to the scribble drawing area and drives drag callbacks", async () => {
        await renderDemo(drawingAreaDemo);
        const scribble = (await screen.findByName("scribble-area")) as Gtk.DrawingArea;
        await fireEvent(scribble, "resize", 200, 200);
        const dragController = collectControllers(scribble, Gtk.GestureDrag)[0];
        expect(dragController).toBeInstanceOf(Gtk.GestureDrag);
        if (!dragController) return;
        await fireEvent(dragController, "drag-begin", 10, 10);
        await fireEvent(dragController, "drag-update", 5, 5);
        await fireEvent(dragController, "drag-end", 15, 15);
        expect(scribble.getContentWidth()).toBe(100);
    });
});
