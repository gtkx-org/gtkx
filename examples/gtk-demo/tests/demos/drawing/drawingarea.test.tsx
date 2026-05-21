import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { drawingAreaDemo } from "../../../src/demos/drawing/drawingarea.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("drawingAreaDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(drawingAreaDemo.id).toBe("drawingarea");
        expect(drawingAreaDemo.title).toBe("Drawing Area");
        expect(drawingAreaDemo.description.length).toBeGreaterThan(0);
        expect(drawingAreaDemo.keywords).toEqual(expect.arrayContaining(["drawing", "GtkDrawingArea"]));
        expect(typeof drawingAreaDemo.sourceCode).toBe("string");
        expect(drawingAreaDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(drawingAreaDemo.defaultWidth).toBe(250);
        expect(drawingAreaDemo.component).toBeTypeOf("function");
    });

    it("populates the host window reference on mount", async () => {
        if (!drawingAreaDemo.component) throw new Error("drawingarea demo component missing");
        const { window } = await renderDemo(drawingAreaDemo.component);
        const win = window.current;
        expect(win).not.toBeNull();
        expect(win).toBeInstanceOf(Gtk.Window);
    });
});

describe("drawingAreaDemo rendering", () => {
    it("renders both the knockout-groups heading and the scribble-area heading", async () => {
        if (!drawingAreaDemo.component) throw new Error("drawingarea demo component missing");
        const { container } = await renderDemo(drawingAreaDemo.component);
        const labels = findAllOfType(container, Gtk.Label);
        const knockout = labels.find((l) => l.getLabel() === "Knockout groups");
        const scribble = labels.find((l) => l.getLabel() === "Scribble area");
        expect(knockout).toBeInstanceOf(Gtk.Label);
        expect(scribble).toBeInstanceOf(Gtk.Label);
        expect(knockout?.hasCssClass("heading")).toBe(true);
        expect(scribble?.hasCssClass("heading")).toBe(true);
    });

    it("renders two GtkDrawingArea widgets each sized 100x100", async () => {
        if (!drawingAreaDemo.component) throw new Error("drawingarea demo component missing");
        const { container } = await renderDemo(drawingAreaDemo.component);
        const drawingAreas = findAllOfType(container, Gtk.DrawingArea);
        expect(drawingAreas).toHaveLength(2);
        for (const area of drawingAreas) {
            expect(area.getContentWidth()).toBe(100);
            expect(area.getContentHeight()).toBe(100);
            expect(area.getAccessibleRole()).toBe(Gtk.AccessibleRole.IMG);
        }
    });

    it("wraps each drawing area in a frame stretching vertically", async () => {
        if (!drawingAreaDemo.component) throw new Error("drawingarea demo component missing");
        const { container } = await renderDemo(drawingAreaDemo.component);
        const frames = findAllOfType(container, Gtk.Frame);
        expect(frames.length).toBeGreaterThanOrEqual(2);
        for (const frame of frames) {
            expect(frame.getVexpand()).toBe(true);
        }
    });
});

describe("drawingAreaDemo gestures", () => {
    it("attaches a GtkGestureDrag controller to the scribble drawing area and drives drag callbacks", async () => {
        if (!drawingAreaDemo.component) throw new Error("drawingarea demo component missing");
        const { container } = await renderDemo(drawingAreaDemo.component);
        const drawingAreas = findAllOfType(container, Gtk.DrawingArea);
        const scribble = drawingAreas[1];
        expect(scribble).toBeInstanceOf(Gtk.DrawingArea);
        if (!scribble) return;
        await fireEvent(scribble as Gtk.Widget, "resize", 200, 200);
        const controllers = scribble.observeControllers();
        const dragController = collectControllers(controllers).find((c) => c instanceof Gtk.GestureDrag);
        expect(dragController).toBeInstanceOf(Gtk.GestureDrag);
        if (!dragController) return;
        await fireEvent(dragController as Gtk.EventController, "drag-begin", 10, 10);
        await fireEvent(dragController as Gtk.EventController, "drag-update", 5, 5);
        await fireEvent(dragController as Gtk.EventController, "drag-end", 15, 15);
        expect(scribble.getContentWidth()).toBe(100);
    });
});

const collectControllers = (model: { getNItems(): number; getItem(index: number): unknown }): Gtk.EventController[] => {
    const items: Gtk.EventController[] = [];
    const count = model.getNItems();
    for (let i = 0; i < count; i++) {
        const item = model.getItem(i);
        if (item) items.push(item as Gtk.EventController);
    }
    return items;
};
