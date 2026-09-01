import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, screenshot, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { gesturesDemo } from "../../../src/demos/gestures/gestures.js";
import { renderDemo } from "../../test-utils.js";

const findDrawingArea = async (): Promise<Gtk.DrawingArea> =>
    screen.findByName("drawing-area", { as: Gtk.DrawingArea });

const paintWindow = async (): Promise<string> => {
    const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });

    await act(() => {
        window.setVisible(true);
    });

    const shot = await screenshot(window);

    return shot.data;
};

describe("gesturesDemo", () => {
    it("renders a stable 400 by 400 drawing area", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        expect(drawingArea).toHaveObjectProperty("contentWidth", 400);
        expect(drawingArea).toHaveObjectProperty("contentHeight", 400);
        const first = await paintWindow();
        expect(first.length).toBeGreaterThan(0);
        expect(await paintWindow()).toBe(first);
    });

    it("paints the swipe trail after a swipe", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const baseline = await paintWindow();
        await userEvent.swipe(drawingArea, 200, 100);
        expect(await paintWindow()).not.toBe(baseline);
    });

    it("paints the long-press indicator", async () => {
        await renderDemo(gesturesDemo);
        const drawingArea = await findDrawingArea();
        const baseline = await paintWindow();
        await userEvent.longPress(drawingArea, 150, 150);
        expect(await paintWindow()).not.toBe(baseline);
    });
});
