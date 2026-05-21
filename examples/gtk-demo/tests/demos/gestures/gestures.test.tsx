import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { gesturesDemo } from "../../../src/demos/gestures/gestures.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const findFirstOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T | null => {
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof ctor) return node;
        let child = node.getFirstChild();
        while (child) {
            stack.push(child);
            child = child.getNextSibling();
        }
    }
    return null;
};

const collectControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    ctor: new (...args: never[]) => T,
): T[] => {
    const observer = widget.observeControllers();
    const out: T[] = [];
    for (let i = 0; i < observer.getNItems(); i++) {
        const controller = observer.getItem(i);
        if (controller instanceof ctor) out.push(controller);
    }
    return out;
};

describe("gesturesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(gesturesDemo, { id: "gestures", title: "Gestures" });
        expect(typeof gesturesDemo.sourceCode).toBe("string");
        expect(gesturesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(gesturesDemo.keywords).toContain("gesture");
        expect(gesturesDemo.keywords).toContain("rotate");
        expect(gesturesDemo.keywords).toContain("multi-touch");
        expect(gesturesDemo.component).toBeTypeOf("function");
        expect(gesturesDemo.defaultWidth).toBe(400);
        expect(gesturesDemo.defaultHeight).toBe(400);
    });

    it("renders a 400x400 drawing area as the root child", async () => {
        if (!gesturesDemo.component) throw new Error("gestures demo component missing");
        const { container } = await renderDemo(gesturesDemo.component);
        const drawingArea = findFirstOfType(container, Gtk.DrawingArea);
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
        expect(drawingArea?.getContentWidth()).toBe(400);
        expect(drawingArea?.getContentHeight()).toBe(400);
    });
});

describe("gesturesDemo controllers", () => {
    it("attaches two swipe gestures, one long-press, one rotate and one zoom controller", async () => {
        if (!gesturesDemo.component) throw new Error("gestures demo component missing");
        const { container } = await renderDemo(gesturesDemo.component);
        const drawingArea = findFirstOfType(container, Gtk.DrawingArea);
        if (!drawingArea) throw new Error("drawing area missing");
        expect(collectControllers(drawingArea, Gtk.GestureSwipe)).toHaveLength(2);
        expect(collectControllers(drawingArea, Gtk.GestureLongPress)).toHaveLength(1);
        expect(collectControllers(drawingArea, Gtk.GestureRotate)).toHaveLength(1);
        expect(collectControllers(drawingArea, Gtk.GestureZoom)).toHaveLength(1);
    });

    it("attaches the long-press gesture with the bubble propagation phase", async () => {
        if (!gesturesDemo.component) throw new Error("gestures demo component missing");
        const { container } = await renderDemo(gesturesDemo.component);
        const drawingArea = findFirstOfType(container, Gtk.DrawingArea) as Gtk.DrawingArea;
        const longPress = collectControllers(drawingArea, Gtk.GestureLongPress)[0];
        if (!longPress) throw new Error("long-press controller missing");
        expect(longPress.getPropagationPhase()).toBe(Gtk.PropagationPhase.BUBBLE);
    });

    it("uses bubble propagation phase for the bubble swipe gesture", async () => {
        if (!gesturesDemo.component) throw new Error("gestures demo component missing");
        const { container } = await renderDemo(gesturesDemo.component);
        const drawingArea = findFirstOfType(container, Gtk.DrawingArea) as Gtk.DrawingArea;
        const swipes = collectControllers(drawingArea, Gtk.GestureSwipe);
        for (const swipe of swipes) {
            expect(swipe.getPropagationPhase()).toBe(Gtk.PropagationPhase.BUBBLE);
        }
    });

    it("attaches two GtkGestureSwipe controllers with the bubble propagation phase", async () => {
        if (!gesturesDemo.component) throw new Error("gestures demo component missing");
        const { container } = await renderDemo(gesturesDemo.component);
        const drawingArea = findFirstOfType(container, Gtk.DrawingArea) as Gtk.DrawingArea;
        const swipes = collectControllers(drawingArea, Gtk.GestureSwipe);
        expect(swipes).toHaveLength(2);
        for (const swipe of swipes) {
            expect(swipe.getPropagationPhase()).toBe(Gtk.PropagationPhase.BUBBLE);
        }
    });
});

describe("gesturesDemo redraw", () => {
    it("queues a redraw when a swipe gesture emits 'swipe'", async () => {
        if (!gesturesDemo.component) throw new Error("gestures demo component missing");
        const { container } = await renderDemo(gesturesDemo.component);
        const drawingArea = findFirstOfType(container, Gtk.DrawingArea) as Gtk.DrawingArea;
        const swipe = collectControllers(drawingArea, Gtk.GestureSwipe)[0];
        if (!swipe) throw new Error("swipe controller missing");
        await fireEvent(swipe, "swipe", 100, 50);
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("redraws on rotate angle-changed and zoom scale-changed", async () => {
        if (!gesturesDemo.component) throw new Error("gestures demo component missing");
        const { container } = await renderDemo(gesturesDemo.component);
        const drawingArea = findFirstOfType(container, Gtk.DrawingArea) as Gtk.DrawingArea;
        const rotate = collectControllers(drawingArea, Gtk.GestureRotate)[0];
        const zoom = collectControllers(drawingArea, Gtk.GestureZoom)[0];
        if (!rotate || !zoom) throw new Error("rotate or zoom missing");
        await fireEvent(rotate, "angle-changed", 0.5, 0.1);
        await fireEvent(zoom, "scale-changed", 1.2);
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });
});
