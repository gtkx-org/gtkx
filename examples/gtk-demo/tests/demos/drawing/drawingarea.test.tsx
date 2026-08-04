import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { drawingAreaDemo } from "../../../src/demos/drawing/drawingarea.js";
import { renderDemo } from "../../test-utils.js";

const renderFrames = async (): Promise<{ knockoutFrame: Gtk.Frame; scribbleFrame: Gtk.Frame }> => {
    await renderDemo(drawingAreaDemo);
    const knockoutFrame = await screen.findByName("knockout-frame", { as: Gtk.Frame });
    const scribbleFrame = await screen.findByName("scribble-frame", { as: Gtk.Frame });

    return { knockoutFrame, scribbleFrame };
};

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

    it("mounts the demo inside the host window with both framed drawing areas reachable", async () => {
        await renderDemo(drawingAreaDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW);
        expect(within(window).getByName("knockout-frame")).toBeInstanceOf(Gtk.Frame);
        expect(within(window).getByName("scribble-frame")).toBeInstanceOf(Gtk.Frame);
    });
});

describe("drawingAreaDemo rendering", () => {
    it("renders both the knockout-groups heading and the scribble-area heading", async () => {
        await renderDemo(drawingAreaDemo);

        const knockout = await screen.findByRole(Gtk.AccessibleRole.LABEL, {
            name: "Knockout groups",
            as: Gtk.Label,
        });

        const scribble = await screen.findByRole(Gtk.AccessibleRole.LABEL, {
            name: "Scribble area",
            as: Gtk.Label,
        });

        expect(knockout).toHaveClass("heading");
        expect(scribble).toHaveClass("heading");
    });

    it("renders two GtkDrawingArea widgets each sized 100x100", async () => {
        const { knockoutFrame, scribbleFrame } = await renderFrames();

        for (const frame of [knockoutFrame, scribbleFrame]) {
            const area = within(frame).getByRole(Gtk.AccessibleRole.IMG, { as: Gtk.DrawingArea });
            expect(area).toHaveObjectProperty("contentWidth", 100);
            expect(area).toHaveObjectProperty("contentHeight", 100);
        }
    });

    it("wraps each drawing area in a vertical-expanding frame", async () => {
        const { knockoutFrame, scribbleFrame } = await renderFrames();

        for (const frame of [knockoutFrame, scribbleFrame]) {
            expect(frame).toHaveObjectProperty("vexpand", true);
        }

        expect(within(knockoutFrame).getByName("knockout-area")).toBeInstanceOf(Gtk.DrawingArea);
        expect(within(scribbleFrame).getByName("scribble-area")).toBeInstanceOf(Gtk.DrawingArea);
    });
});

describe("drawingAreaDemo gestures", () => {
    it(
        "paints the brush once per drag phase (begin, update, end) after the scribble surface is initialised",
        async () => {
            await renderDemo(drawingAreaDemo);
            const scribble = await screen.findByName("scribble-area", { as: Gtk.DrawingArea });
            await fireEvent(scribble, "resize", 100, 100);
            const queueDraw = vi.spyOn(scribble, "queueDraw");
            await userEvent.drag(scribble, 5, 5, { startX: 10, startY: 10, steps: 1 });
            expect(queueDraw).toHaveBeenCalledTimes(3);
        },
    );
});
