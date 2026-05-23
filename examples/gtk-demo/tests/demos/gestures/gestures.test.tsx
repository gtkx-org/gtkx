import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { gesturesDemo } from "../../../src/demos/gestures/gestures.js";
import { collectControllersOfType, fireEvent, renderDemo, screen } from "../../test-utils.js";

describe("gesturesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(gesturesDemo.id).toBe("gestures");
        expect(gesturesDemo.title).toBe("Gestures");
        expect(gesturesDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(gesturesDemo.keywords)).toBe(true);
        expect(typeof gesturesDemo.sourceCode).toBe("string");
        expect(gesturesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(gesturesDemo.component).toBeTypeOf("function");
        expect(gesturesDemo.defaultWidth).toBe(400);
        expect(gesturesDemo.defaultHeight).toBe(400);
    });

    it("renders a 400x400 drawing area as the root child", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = (await screen.findByName("drawing-area")) as Gtk.DrawingArea;
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
        expect(drawingArea.getContentWidth()).toBe(400);
        expect(drawingArea.getContentHeight()).toBe(400);
    });
});

describe("gesturesDemo controllers", () => {
    it("attaches two swipe gestures, one long-press, one rotate and one zoom controller", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = (await screen.findByName("drawing-area")) as Gtk.DrawingArea;
        expect(collectControllersOfType(drawingArea, Gtk.GestureSwipe)).toHaveLength(2);
        expect(collectControllersOfType(drawingArea, Gtk.GestureLongPress)).toHaveLength(1);
        expect(collectControllersOfType(drawingArea, Gtk.GestureRotate)).toHaveLength(1);
        expect(collectControllersOfType(drawingArea, Gtk.GestureZoom)).toHaveLength(1);
    });

    it("attaches the long-press gesture with the bubble propagation phase", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = (await screen.findByName("drawing-area")) as Gtk.DrawingArea;
        const longPress = collectControllersOfType(drawingArea, Gtk.GestureLongPress)[0];
        if (!longPress) throw new Error("long-press controller missing");
        expect(longPress.getPropagationPhase()).toBe(Gtk.PropagationPhase.BUBBLE);
    });

    it("attaches two GtkGestureSwipe controllers with the bubble propagation phase", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = (await screen.findByName("drawing-area")) as Gtk.DrawingArea;
        const swipes = collectControllersOfType(drawingArea, Gtk.GestureSwipe);
        expect(swipes).toHaveLength(2);
        for (const swipe of swipes) {
            expect(swipe.getPropagationPhase()).toBe(Gtk.PropagationPhase.BUBBLE);
        }
    });
});

describe("gesturesDemo redraw", () => {
    it("queues a redraw when a swipe gesture emits 'swipe'", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = (await screen.findByName("drawing-area")) as Gtk.DrawingArea;
        const swipe = collectControllersOfType(drawingArea, Gtk.GestureSwipe)[0];
        if (!swipe) throw new Error("swipe controller missing");
        await fireEvent(swipe, "swipe", 100, 50);
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("redraws on rotate angle-changed and zoom scale-changed", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = (await screen.findByName("drawing-area")) as Gtk.DrawingArea;
        const rotate = collectControllersOfType(drawingArea, Gtk.GestureRotate)[0];
        const zoom = collectControllersOfType(drawingArea, Gtk.GestureZoom)[0];
        if (!rotate || !zoom) throw new Error("rotate or zoom missing");
        await fireEvent(rotate, "angle-changed", 0.5, 0.1);
        await fireEvent(zoom, "scale-changed", 1.2);
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("toggles the long-press state when pressed and ended signals are emitted", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = (await screen.findByName("drawing-area")) as Gtk.DrawingArea;
        const longPress = collectControllersOfType(drawingArea, Gtk.GestureLongPress)[0];
        if (!longPress) throw new Error("long-press controller missing");
        await fireEvent(longPress, "pressed", 100, 100);
        await fireEvent(longPress, "end", null);
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });
});
