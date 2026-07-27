import * as Gtk from "@gtkx/gi/gtk";
import { act, fireEvent, screen, screenshot, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { gesturesDemo } from "../../../src/demos/gestures/gestures.js";
import { renderDemo } from "../../test-utils.js";

const findDrawingArea = async (): Promise<Gtk.DrawingArea> =>
    (await screen.findByName("drawing-area")) as Gtk.DrawingArea;

const findControllersOfType = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    type: new (...args: never[]) => T,
): T[] => {
    const list = widget.observeControllers();
    const result: T[] = [];

    for (let i = 0; i < list.getNItems(); i++) {
        const item = list.getItem(i);

        if (item instanceof type) {
            result.push(item);
        }
    }

    return result;
};

const findController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    type: new (...args: never[]) => T,
): T => {
    const [controller] = findControllersOfType(widget, type);

    if (!controller) {
        throw new Error(`expected the widget to own a ${type.name} controller`);
    }

    return controller;
};

const findThreeFingerSwipe = (widget: Gtk.Widget): Gtk.GestureSwipe => {
    const swipe = findControllersOfType(widget, Gtk.GestureSwipe).find((gesture) => gesture.nPoints === 3);

    if (!swipe) {
        throw new Error("expected a 3-finger swipe gesture on the widget");
    }

    return swipe;
};

const paintWindow = async (): Promise<string> => {
    const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;

    await act(() => {
        window.setVisible(true);
    });

    const shot = await screenshot(window);

    return shot.data;
};

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

    it("renders a 400x400 drawing area as the demo root", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        expect(drawingArea.getContentWidth()).toBe(400);
        expect(drawingArea.getContentHeight()).toBe(400);
    });
});

describe("gesturesDemo redraw on gesture", () => {
    it("queues a redraw when a swipe gesture completes", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const queueDraw = vi.spyOn(drawingArea, "queueDraw");
        await userEvent.swipe(drawingArea, 100, 50);
        expect(queueDraw).toHaveBeenCalled();
    });

    it("queues a redraw when a rotate angle change is recognized", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const queueDraw = vi.spyOn(drawingArea, "queueDraw");
        await userEvent.rotate(drawingArea, 0.5, 0.1);
        expect(queueDraw).toHaveBeenCalled();
    });

    it("queues a redraw when a zoom scale change is recognized", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const queueDraw = vi.spyOn(drawingArea, "queueDraw");
        await userEvent.zoom(drawingArea, 1.2);
        expect(queueDraw).toHaveBeenCalled();
    });

    it("queues a redraw when a long press is recognized", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const queueDraw = vi.spyOn(drawingArea, "queueDraw");
        await userEvent.longPress(drawingArea, 100, 100);
        expect(queueDraw).toHaveBeenCalled();
    });
});

describe("gesturesDemo gesture controllers", () => {
    it("queues another redraw when the long press gesture ends", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const longPress = findController(drawingArea, Gtk.GestureLongPress);
        expect(longPress).toBeInstanceOf(Gtk.GestureLongPress);
        await userEvent.longPress(drawingArea, 100, 100);
        const queueDraw = vi.spyOn(drawingArea, "queueDraw");
        await fireEvent(longPress, "end", null);
        expect(queueDraw).toHaveBeenCalled();
    });

    it("declares exactly two swipe gestures and denies the 3-finger one on a non-null sequence", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        expect(findControllersOfType(drawingArea, Gtk.GestureSwipe)).toHaveLength(2);
        const threeFingerSwipe = findThreeFingerSwipe(drawingArea);
        const setState = vi.spyOn(threeFingerSwipe, "setState");
        await fireEvent(threeFingerSwipe, "begin", drawingArea);
        expect(setState).toHaveBeenCalledWith(Gtk.EventSequenceState.DENIED);
    });

    it("does not deny the 3-finger swipe when begin fires with a null sequence", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const threeFingerSwipe = findThreeFingerSwipe(drawingArea);
        const setState = vi.spyOn(threeFingerSwipe, "setState");
        await fireEvent(threeFingerSwipe, "begin", null);
        expect(setState).not.toHaveBeenCalled();
    });
});

describe("gesturesDemo render output", () => {
    it("paints a stable, deterministic frame on the initial render with no gesture state", async () => {
        await renderDemo(gesturesDemo);
        const first = await paintWindow();
        const second = await paintWindow();
        expect(first.length).toBeGreaterThan(0);
        expect(second).toBe(first);
    });

    it("paints the swipe trail after a swipe gesture sets the velocity state", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const baseline = await paintWindow();
        await userEvent.swipe(drawingArea, 200, 100);
        const painted = await paintWindow();
        expect(painted).not.toBe(baseline);
    });
});

describe("gesturesDemo gesture painting", () => {
    it("paints the rotate indicator when the rotate gesture is recognized", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const rotate = findController(drawingArea, Gtk.GestureRotate);
        const zoom = findController(drawingArea, Gtk.GestureZoom);
        expect(rotate).toBeInstanceOf(Gtk.GestureRotate);
        expect(zoom).toBeInstanceOf(Gtk.GestureZoom);
        const baseline = await paintWindow();
        vi.spyOn(rotate, "isRecognized").mockReturnValue(true);
        vi.spyOn(rotate, "getAngleDelta").mockReturnValue(Math.PI / 6);
        vi.spyOn(zoom, "getScaleDelta").mockReturnValue(1.25);
        vi.spyOn(zoom, "getBoundingBoxCenter").mockReturnValue([true, 120, 130]);
        await userEvent.rotate(drawingArea, Math.PI / 6);
        const painted = await paintWindow();
        expect(painted).not.toBe(baseline);
    });

    it("paints the scaled rectangle when the zoom gesture is recognized without a bounding-box center", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const zoom = findController(drawingArea, Gtk.GestureZoom);
        expect(zoom).toBeInstanceOf(Gtk.GestureZoom);
        const baseline = await paintWindow();
        vi.spyOn(zoom, "isRecognized").mockReturnValue(true);
        vi.spyOn(zoom, "getScaleDelta").mockReturnValue(1.5);
        vi.spyOn(zoom, "getBoundingBoxCenter").mockReturnValue([false, 0, 0]);
        await userEvent.zoom(drawingArea, 1.5);
        const painted = await paintWindow();
        expect(painted).not.toBe(baseline);
    });

    it("paints the long-press circle and clears it back to the baseline when the gesture ends", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const longPress = findController(drawingArea, Gtk.GestureLongPress);
        expect(longPress).toBeInstanceOf(Gtk.GestureLongPress);
        const baseline = await paintWindow();
        await userEvent.longPress(drawingArea, 150, 150);
        const pressed = await paintWindow();
        expect(pressed).not.toBe(baseline);
        await fireEvent(longPress, "end", null);
        const ended = await paintWindow();
        expect(ended).toBe(baseline);
    });
});
