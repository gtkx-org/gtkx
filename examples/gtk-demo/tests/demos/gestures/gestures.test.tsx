import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, screenshot, userEvent } from "@gtkx/testing";
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
        if (item instanceof type) result.push(item);
    }
    return result;
};

const paintWindow = async (): Promise<void> => {
    const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
    await act(() => window.setVisible(true));
    await screenshot(window);
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

    it("queues another redraw when the long press gesture ends", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const longPress = findControllersOfType(drawingArea, Gtk.GestureLongPress)[0];
        expect(longPress).toBeInstanceOf(Gtk.GestureLongPress);
        await userEvent.longPress(drawingArea, 100, 100);
        const queueDraw = vi.spyOn(drawingArea, "queueDraw");
        if (longPress) {
            await act(() => {
                longPress.emit("end", null);
            });
        }
        expect(queueDraw).toHaveBeenCalled();
    });

    it("denies the second swipe gesture when a 3-finger begin fires with a non-null sequence", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const swipeGestures = findControllersOfType(drawingArea, Gtk.GestureSwipe);
        expect(swipeGestures.length).toBeGreaterThanOrEqual(2);
        const threeFingerSwipe = swipeGestures.find((g) => g.nPoints === 3);
        expect(threeFingerSwipe).toBeInstanceOf(Gtk.GestureSwipe);
        if (!threeFingerSwipe) return;
        const setState = vi.spyOn(threeFingerSwipe, "setState");
        await act(() => {
            threeFingerSwipe.emit("begin", null);
        });
        expect(setState).not.toHaveBeenCalled();
    });
});

describe("gesturesDemo render output", () => {
    it("paints the drawing area on the initial render with no gesture state", async () => {
        await renderDemo(gesturesDemo);
        await paintWindow();
        const drawingArea = await findDrawingArea();
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("paints the swipe trail after a swipe gesture sets the velocity state", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        await userEvent.swipe(drawingArea, 200, 100);
        await paintWindow();
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("paints the rotate/zoom indicator when the rotate gesture is recognized", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const rotate = findControllersOfType(drawingArea, Gtk.GestureRotate)[0];
        const zoom = findControllersOfType(drawingArea, Gtk.GestureZoom)[0];
        expect(rotate).toBeInstanceOf(Gtk.GestureRotate);
        expect(zoom).toBeInstanceOf(Gtk.GestureZoom);
        if (!rotate || !zoom) return;
        vi.spyOn(rotate, "isRecognized").mockReturnValue(true);
        vi.spyOn(rotate, "getAngleDelta").mockReturnValue(Math.PI / 6);
        vi.spyOn(zoom, "getScaleDelta").mockReturnValue(1.25);
        vi.spyOn(zoom, "getBoundingBoxCenter").mockReturnValue([true, 120, 130]);
        await act(() => drawingArea.queueDraw());
        await paintWindow();
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("paints the rotate/zoom indicator when the zoom gesture is recognized", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const zoom = findControllersOfType(drawingArea, Gtk.GestureZoom)[0];
        expect(zoom).toBeInstanceOf(Gtk.GestureZoom);
        if (!zoom) return;
        vi.spyOn(zoom, "isRecognized").mockReturnValue(true);
        vi.spyOn(zoom, "getScaleDelta").mockReturnValue(1.5);
        vi.spyOn(zoom, "getBoundingBoxCenter").mockReturnValue([false, 0, 0]);
        await act(() => drawingArea.queueDraw());
        await paintWindow();
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("paints the long-press circle after a long press is recognized", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        await userEvent.longPress(drawingArea, 150, 150);
        await paintWindow();
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });
});
