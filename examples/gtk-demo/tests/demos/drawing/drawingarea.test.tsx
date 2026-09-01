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
    it("mounts both framed drawing areas inside the host window, knockout above scribble", async () => {
        const { knockoutFrame, scribbleFrame } = await renderFrames();
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW);
        expect(window).toContainElement(knockoutFrame);
        expect(window).toContainElement(scribbleFrame);
        expect(knockoutFrame).toAppearBefore(scribbleFrame);
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

        expect(knockoutFrame).toContainElement(screen.getByName("knockout-area"));
        expect(scribbleFrame).toContainElement(screen.getByName("scribble-area"));
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
